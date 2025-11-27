import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { UserRecord } from "./useUsersData";

type ServiceWithRelations = {
  user_id: string;
  category_id: number;
  subcategory_id: string | null;
  categories: { id: number; name: string } | null;
  subcategories: { id: string; name: string } | null;
};

export type ReportRecord = {
  id: string;
  created_at: string;
  reporter_id: string;
  reported_user_id: string;
  reason_category: string;
  details: string | null;
  reported_content_type: string;
  reported_content_id: string | null;
  status: string;
  moderator_notes: string | null;
  action_taken: string;
  resolved_by: string | null;
  resolved_at: string | null;
};

export type EnrichedReport = ReportRecord & {
  reporter?: Partial<UserRecord> | null;
  reportedUser?: Partial<UserRecord> | null;
};

type UseReportsDataState = {
  reports: EnrichedReport[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateReport: (id: string, payload: Partial<ReportRecord>) => Promise<void>;
  toggleUserBan: (userId: string, banned: boolean) => Promise<void>;
};

export function useReportsData(): UseReportsDataState {
  const [reports, setReports] = useState<EnrichedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("reports")
      .select(
        "id,created_at,reporter_id,reported_user_id,reason_category,details,reported_content_type,reported_content_id,status,moderator_notes,action_taken,resolved_by,resolved_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const reportsData = data ?? [];
    const userIds = Array.from(
      new Set(
        reportsData
          .flatMap(report => [report.reporter_id, report.reported_user_id])
          .filter(Boolean)
      )
    );

    let usersMap = new Map<string, Partial<UserRecord>>();
    if (userIds.length) {
      // Cargar usuarios
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select(
          "id,name,last_name,email,description,location,is_provider,is_validated,is_banned,profile_pic"
        )
        .in("id", userIds);

      if (usersError) {
        console.error("Error al cargar usuarios:", usersError);
        setError(`Error al cargar usuarios: ${usersError.message}`);
      } else if (usersData) {
        // Crear el mapa inicial con los datos de usuarios
        usersMap = new Map(usersData.map(user => [user.id, user]));
        console.log(
          `Cargados ${usersData.length} usuarios de ${userIds.length} IDs solicitados`
        );

        // Cargar categorías y subcategorías desde user_professional_services con JOINs
        const providerIds = usersData.filter(u => u.is_provider).map(u => u.id);
        if (providerIds.length > 0) {
          const { data: servicesData, error: servicesError } = await supabase
            .from("user_professional_services")
            .select(
              `
              user_id,
              category_id,
              subcategory_id,
              categories:category_id (id, name),
              subcategories:subcategory_id (id, name)
            `
            )
            .in("user_id", providerIds);

          if (!servicesError && servicesData) {
            // Agrupar categorías y subcategorías por usuario
            const categoriesByUser = new Map<string, Map<string, string[]>>();
            servicesData.forEach((service: ServiceWithRelations) => {
              const userId = service.user_id;
              const categoryName = service.categories?.name;
              const subcategoryName = service.subcategories?.name;

              if (!categoryName) return;

              if (!categoriesByUser.has(userId)) {
                categoriesByUser.set(userId, new Map());
              }

              const userCategories = categoriesByUser.get(userId)!;
              if (!userCategories.has(categoryName)) {
                userCategories.set(categoryName, []);
              }

              if (subcategoryName) {
                const subcategories = userCategories.get(categoryName)!;
                if (!subcategories.includes(subcategoryName)) {
                  subcategories.push(subcategoryName);
                }
              }
            });

            // Agregar categorías a cada usuario
            categoriesByUser.forEach((categoryMap, userId) => {
              const user = usersMap.get(userId);
              if (user) {
                const serviceCategories = Array.from(categoryMap.entries()).map(
                  ([category, subcategories]) => ({
                    category,
                    subcategories,
                  })
                );
                usersMap.set(userId, { ...user, serviceCategories });
              }
            });
          }
        }

        // Verificar si faltan algunos usuarios
        const foundIds = new Set(usersData.map(u => u.id));
        const missingIds = userIds.filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
          console.warn("IDs no encontrados en la base de datos:", missingIds);
        }
      } else {
        console.warn("No se encontraron usuarios para los IDs:", userIds);
      }
    }

    const enriched = reportsData.map(report => ({
      ...report,
      reporter: usersMap.get(report.reporter_id),
      reportedUser: usersMap.get(report.reported_user_id),
    }));

    console.log(`Reportes enriquecidos cargados: ${enriched.length} reportes`);
    enriched.forEach((report, index) => {
      if (index < 3) {
        // Solo log los primeros 3 para no saturar
        console.log(`Reporte ${index + 1}:`, {
          id: report.id,
          status: report.status,
          action_taken: report.action_taken,
          resolved_by: report.resolved_by,
          resolved_at: report.resolved_at,
        });
      }
    });

    setReports(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchReports();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchReports]);

  const refetch = useCallback(async () => {
    await fetchReports();
  }, [fetchReports]);

  const updateReport = useCallback(
    async (id: string, payload: Partial<ReportRecord>) => {
      // Asegurarse de que los valores null se envíen correctamente
      const cleanPayload: Record<string, any> = {};
      Object.keys(payload).forEach(key => {
        const value = payload[key as keyof typeof payload];
        // Incluir null explícitamente, pero omitir undefined
        if (value !== undefined) {
          cleanPayload[key] = value;
        }
      });

      console.log(
        "Intentando actualizar reporte en Supabase con payload:",
        cleanPayload
      );

      // Primero intentar UPDATE sin select para evitar problemas de 406
      const {
        data: updateData,
        error: updateError,
        count,
      } = await supabase
        .from("reports")
        .update(cleanPayload)
        .eq("id", id)
        .select();

      if (updateError) {
        console.error("❌ Error al actualizar reporte:", updateError);
        console.error("Detalles del error:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });

        // Si el error es PGRST116 (0 rows), puede ser un problema de RLS
        if (updateError.code === "PGRST116") {
          console.error("⚠️ El UPDATE no devolvió filas. Esto puede indicar:");
          console.error("   1. RLS está bloqueando la actualización");
          console.error("   2. El reporte no existe o fue eliminado");
          console.error(
            "   3. No tienes permisos para actualizar este reporte"
          );
          console.error(
            "   Verifica que VITE_SUPABASE_SERVICE_ROLE_KEY esté configurada"
          );
        }

        throw new Error(updateError.message);
      }

      console.log("Update response:", {
        updateData,
        count,
        hasData: !!updateData?.length,
      });

      // Si no hay datos devueltos, hacer un SELECT separado
      let updatedReport: any = null;

      if (updateData && updateData.length > 0) {
        updatedReport = updateData[0];
        console.log(
          "✅ Update exitoso, datos devueltos por Supabase:",
          updatedReport
        );
      } else {
        console.warn(
          "⚠️ El UPDATE no devolvió datos, haciendo SELECT como fallback..."
        );
        // Esperar un momento para que la BD se actualice
        await new Promise(resolve => setTimeout(resolve, 200));

        const { data: selectData, error: selectError } = await supabase
          .from("reports")
          .select("*")
          .eq("id", id)
          .single();

        if (selectError) {
          console.error(
            "❌ Error al obtener reporte actualizado:",
            selectError
          );
          throw new Error(
            `No se pudo obtener el reporte actualizado: ${selectError.message}`
          );
        }

        updatedReport = selectData;
        console.log(
          "✅ Reporte obtenido por SELECT después del UPDATE:",
          updatedReport
        );
      }

      if (!updatedReport) {
        throw new Error(
          "No se pudo obtener el reporte actualizado después del UPDATE"
        );
      }

      // Verificar que los datos se guardaron correctamente
      console.log("🔍 Verificando que los datos se guardaron correctamente...");
      const verificationIssues: string[] = [];

      // Función para normalizar fechas (Z y +00:00 son equivalentes)
      const normalizeDate = (value: any): string | null => {
        if (value === null || value === undefined) return null;
        if (
          typeof value === "string" &&
          value.includes("T") &&
          value.includes("Z")
        ) {
          // Convertir Z a +00:00 para comparación
          return value.replace("Z", "+00:00");
        }
        return String(value);
      };

      Object.keys(cleanPayload).forEach(key => {
        const sentValue = cleanPayload[key];
        const receivedValue = updatedReport[key as keyof typeof updatedReport];

        // Normalizar valores para comparación
        let sentNormalized: string | null;
        let receivedNormalized: string | null;

        // Si es una fecha/timestamp, normalizar el formato
        if (
          key.includes("_at") ||
          key.includes("date") ||
          key.includes("time")
        ) {
          sentNormalized = normalizeDate(sentValue);
          receivedNormalized = normalizeDate(receivedValue);
        } else {
          sentNormalized =
            sentValue === null || sentValue === undefined
              ? null
              : String(sentValue);
          receivedNormalized =
            receivedValue === null || receivedValue === undefined
              ? null
              : String(receivedValue);
        }

        if (sentNormalized !== receivedNormalized) {
          verificationIssues.push(
            `❌ ${key}: enviado "${sentValue}" pero BD devolvió "${receivedValue}"`
          );
        } else {
          console.log(`✅ ${key}: correcto (${sentValue})`);
        }
      });

      if (verificationIssues.length > 0) {
        console.error(
          "⚠️ PROBLEMA: Los datos no se guardaron correctamente en la BD:"
        );
        verificationIssues.forEach(issue => console.error(issue));
        console.error(
          "Esto puede indicar un problema de RLS o permisos en Supabase"
        );
      } else {
        console.log("✅ Todos los datos se guardaron correctamente en la BD");
      }

      // Actualizar el estado local con los datos actualizados de la BD
      setReports(prev =>
        prev.map(report => {
          if (report.id === id) {
            console.log("Actualizando reporte en estado local:", {
              id,
              oldStatus: report.status,
              newStatus: updatedReport.status,
              oldActionTaken: report.action_taken,
              newActionTaken: updatedReport.action_taken,
              oldResolvedBy: report.resolved_by,
              newResolvedBy: updatedReport.resolved_by,
              oldModeratorNotes: report.moderator_notes,
              newModeratorNotes: updatedReport.moderator_notes,
            });
            return {
              ...report,
              ...updatedReport,
              // Mantener los datos de usuarios que ya teníamos
              reporter: report.reporter,
              reportedUser: report.reportedUser,
            };
          }
          return report;
        })
      );

      console.log("✅ Estado local actualizado");
    },
    []
  );

  const toggleUserBan = useCallback(async (userId: string, banned: boolean) => {
    const { error } = await supabase
      .from("users")
      .update({ is_banned: banned })
      .eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }

    setReports(prev =>
      prev.map(report =>
        report.reported_user_id === userId
          ? {
              ...report,
              reportedUser: report.reportedUser
                ? { ...report.reportedUser, is_banned: banned }
                : report.reportedUser,
            }
          : report
      )
    );
  }, []);

  return {
    reports,
    loading,
    error,
    refetch,
    updateReport,
    toggleUserBan,
  };
}
