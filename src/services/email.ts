import { supabase } from "../lib/supabaseClient";

type ResolutionEmailPayload = {
  to: string;
  toName: string;
  subject: string;
  message: string;
};

type RejectionEmailPayload = {
  to: string;
  toName: string;
  missingDocuments: {
    police_clearance: boolean;
    professional_credential: boolean;
  };
  userId: string;
};

type ApprovalEmailPayload = {
  to: string;
  toName: string;
};

type ReportNotificationToReportedUserPayload = {
  to: string;
  toName: string;
  reasonCategory: string;
  actionTaken: string;
  moderatorNotes?: string | null;
  reporterName: string;
};

type ReportResolutionToReporterPayload = {
  to: string;
  toName: string;
  reasonCategory: string;
  actionTaken: string;
  moderatorNotes?: string | null;
  reportedUserName: string;
};

/**
 * Envía un correo informando la resolución de un reporte.
 * Usa la Edge Function `send-email`, por lo que debe existir del lado de Supabase.
 */
export async function sendResolutionEmail({
  to,
  toName,
  subject,
  message,
}: ResolutionEmailPayload) {
  if (!to) {
    throw new Error("El destinatario es obligatorio para enviar el correo");
  }

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      type: "report_resolution",
      to,
      toName,
      subject,
      message,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Envía un correo notificando el rechazo de un proveedor y qué documentos faltan.
 */
export async function sendProviderRejectionEmail({
  to,
  toName,
  missingDocuments,
  userId,
}: RejectionEmailPayload) {
  if (!to) {
    throw new Error("El destinatario es obligatorio para enviar el correo");
  }

  if (!userId) {
    throw new Error(
      "El userId es obligatorio para enviar el correo de rechazo"
    );
  }

  console.log("Enviando email de rechazo con userId:", userId);
  console.log("missingDocuments:", missingDocuments);

  // La Edge Function construye el email desde cero, solo enviamos los datos necesarios
  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      type: "provider_rejection",
      to,
      toName,
      userId,
      missingDocuments,
    },
  });

  if (error) {
    console.error("Error al invocar Edge Function:", error);
    throw new Error(error.message);
  }
}

/**
 * Envía un correo notificando la aprobación de un proveedor.
 */
export async function sendProviderApprovalEmail({
  to,
  toName,
}: ApprovalEmailPayload) {
  if (!to) {
    throw new Error("El destinatario es obligatorio para enviar el correo");
  }

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      type: "provider_approval",
      to,
      toName,
    },
  });

  if (error) {
    console.error("Error al invocar Edge Function:", error);
    throw new Error(error.message);
  }
}

/**
 * Envía un correo al usuario reportado informándole que fue reportado y la resolución.
 */
export async function sendReportNotificationToReportedUser({
  to,
  toName,
  reasonCategory,
  actionTaken,
  moderatorNotes,
  reporterName,
}: ReportNotificationToReportedUserPayload) {
  if (!to) {
    throw new Error("El destinatario es obligatorio para enviar el correo");
  }

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      type: "report_notification_to_reported_user",
      to,
      toName,
      reasonCategory,
      actionTaken,
      moderatorNotes: moderatorNotes || null,
      reporterName,
    },
  });

  if (error) {
    console.error("Error al invocar Edge Function:", error);
    throw new Error(error.message);
  }
}

/**
 * Envía un correo al usuario que hizo el reporte informándole que su reporte fue atendido.
 */
export async function sendReportResolutionToReporter({
  to,
  toName,
  reasonCategory,
  actionTaken,
  moderatorNotes,
  reportedUserName,
}: ReportResolutionToReporterPayload) {
  if (!to) {
    throw new Error("El destinatario es obligatorio para enviar el correo");
  }

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      type: "report_resolution_to_reporter",
      to,
      toName,
      reasonCategory,
      actionTaken,
      moderatorNotes: moderatorNotes || null,
      reportedUserName,
    },
  });

  if (error) {
    console.error("Error al invocar Edge Function:", error);
    throw new Error(error.message);
  }
}
