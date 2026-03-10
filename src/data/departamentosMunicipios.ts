/** Departamentos y municipios para facturación (El Salvador). */

export const DEPARTAMENTOS = [
  { value: "01", label: "Ahuachapán" },
  { value: "02", label: "Santa Ana" },
  { value: "03", label: "Sonsonate" },
  { value: "04", label: "Chalatenango" },
  { value: "05", label: "La Libertad" },
  { value: "06", label: "San Salvador" },
  { value: "07", label: "Cuscatlán" },
  { value: "08", label: "La Paz" },
  { value: "09", label: "Cabañas" },
  { value: "10", label: "San Vicente" },
  { value: "11", label: "Usulután" },
  { value: "12", label: "San Miguel" },
  { value: "13", label: "Morazán" },
  { value: "14", label: "La Unión" },
] as const;

export const MUNICIPIOS_POR_DEPARTAMENTO: Record<string, { value: string; label: string }[]> = {
  "06": [
    { value: "01", label: "San Salvador" },
    { value: "02", label: "Aguilares" },
    { value: "03", label: "Apopa" },
    { value: "04", label: "Ayutuxtepeque" },
    { value: "05", label: "Cuscatancingo" },
    { value: "06", label: "Delgado" },
    { value: "07", label: "Ilopango" },
    { value: "08", label: "Mejicanos" },
    { value: "09", label: "Nejapa" },
    { value: "10", label: "Panchimalco" },
    { value: "11", label: "Rosario de Mora" },
    { value: "12", label: "San Marcos" },
    { value: "13", label: "San Martín" },
    { value: "14", label: "Santiago Texacuangos" },
    { value: "15", label: "Santo Tomás" },
    { value: "16", label: "Soyapango" },
    { value: "17", label: "Tonacatepeque" },
    { value: "18", label: "Guazapa" },
    { value: "19", label: "San Bartolomé Perulapía" },
  ],
  "05": [
    { value: "01", label: "Santa Tecla" },
    { value: "02", label: "Antiguo Cuscatlán" },
    { value: "03", label: "Ciudad Arce" },
    { value: "04", label: "Colón" },
    { value: "05", label: "Comasagua" },
    { value: "06", label: "Huizúcar" },
    { value: "07", label: "Jayaque" },
    { value: "08", label: "Jicalapa" },
    { value: "09", label: "La Libertad" },
    { value: "10", label: "Nuevo Cuscatlán" },
    { value: "11", label: "San Juan Opico" },
    { value: "12", label: "Quezaltepeque" },
    { value: "13", label: "Sacacoyo" },
    { value: "14", label: "San José Villanueva" },
    { value: "15", label: "San Matías" },
    { value: "16", label: "San Pablo Tacachico" },
    { value: "17", label: "Tamanique" },
    { value: "18", label: "Talnique" },
    { value: "19", label: "Teotepeque" },
    { value: "20", label: "Tepecoyo" },
    { value: "21", label: "Zaragoza" },
  ],
};

export function getMunicipios(departamento: string): { value: string; label: string }[] {
  return MUNICIPIOS_POR_DEPARTAMENTO[departamento] ?? [{ value: "01", label: "Municipio 01" }];
}
