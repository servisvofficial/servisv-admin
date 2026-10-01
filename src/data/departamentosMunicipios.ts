/**
 * Catálogos de Departamentos (CAT-012) y Municipios (CAT-013 2024)
 * de El Salvador según el Ministerio de Hacienda (44 municipios post-reestructuración 2024).
 *
 * Misma estructura y códigos que en servisv-app y servisv-proyecto-web,
 * con mapeo de los 262 distritos para facilitar la búsqueda y selección.
 */

export interface MunicipioInfo {
  codigo: string;
  nombre: string;
  value: string;
  label: string;
  distritos: string[];
}

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

export const MUNICIPIOS_POR_DEPARTAMENTO: Record<string, MunicipioInfo[]> = {
  "01": [
    {
      codigo: "13",
      nombre: "AHUACHAPAN NORTE",
      value: "13",
      label: "AHUACHAPAN NORTE",
      distritos: ["Atiquizaya", "El Refugio", "San Lorenzo", "Turín"],
    },
    {
      codigo: "14",
      nombre: "AHUACHAPAN CENTRO",
      value: "14",
      label: "AHUACHAPAN CENTRO",
      distritos: ["Ahuachapán", "Apaneca", "Concepción de Ataco", "Tacuba"],
    },
    {
      codigo: "15",
      nombre: "AHUACHAPAN SUR",
      value: "15",
      label: "AHUACHAPAN SUR",
      distritos: ["Guaymango", "Jujutla", "San Francisco Menéndez", "San Pedro Puxtla"],
    },
  ],
  "02": [
    {
      codigo: "14",
      nombre: "SANTA ANA NORTE",
      value: "14",
      label: "SANTA ANA NORTE",
      distritos: ["Masahuat", "Metapán", "Santa Rosa Guachipilín", "Texistepeque"],
    },
    {
      codigo: "15",
      nombre: "SANTA ANA CENTRO",
      value: "15",
      label: "SANTA ANA CENTRO",
      distritos: ["Santa Ana"],
    },
    {
      codigo: "16",
      nombre: "SANTA ANA ESTE",
      value: "16",
      label: "SANTA ANA ESTE",
      distritos: ["Coatepeque", "El Congo"],
    },
    {
      codigo: "17",
      nombre: "SANTA ANA OESTE",
      value: "17",
      label: "SANTA ANA OESTE",
      distritos: [
        "Candelaria de la Frontera",
        "Chalchuapa",
        "El Porvenir",
        "San Antonio Pajonal",
        "San Sebastián Salitrillo",
        "Santiago de la Frontera",
      ],
    },
  ],
  "03": [
    {
      codigo: "17",
      nombre: "SONSONATE NORTE",
      value: "17",
      label: "SONSONATE NORTE",
      distritos: ["Juayúa", "Nahuizalco", "Salcoatitán", "Santa Catarina Masahuat"],
    },
    {
      codigo: "18",
      nombre: "SONSONATE CENTRO",
      value: "18",
      label: "SONSONATE CENTRO",
      distritos: [
        "Sonsonate",
        "Sonzacate",
        "Nahulingo",
        "San Antonio del Monte",
        "Santo Domingo de Guzmán",
      ],
    },
    {
      codigo: "19",
      nombre: "SONSONATE ESTE",
      value: "19",
      label: "SONSONATE ESTE",
      distritos: [
        "Armenia",
        "Caluco",
        "Cuisnahuat",
        "Izalco",
        "San Julián",
        "Santa Isabel Ishuatán",
      ],
    },
    {
      codigo: "20",
      nombre: "SONSONATE OESTE",
      value: "20",
      label: "SONSONATE OESTE",
      distritos: ["Acajutla"],
    },
  ],
  "04": [
    {
      codigo: "34",
      nombre: "CHALATENANGO NORTE",
      value: "34",
      label: "CHALATENANGO NORTE",
      distritos: ["La Palma", "San Ignacio", "Citalá"],
    },
    {
      codigo: "35",
      nombre: "CHALATENANGO CENTRO",
      value: "35",
      label: "CHALATENANGO CENTRO",
      distritos: [
        "Nueva Concepción",
        "Tejutla",
        "La Reina",
        "Agua Caliente",
        "Dulce Nombre de María",
        "El Paraíso",
        "San Fernando",
        "San Francisco Morazán",
        "San Rafael",
        "Santa Rita",
      ],
    },
    {
      codigo: "36",
      nombre: "CHALATENANGO SUR",
      value: "36",
      label: "CHALATENANGO SUR",
      distritos: [
        "Chalatenango",
        "Arcatao",
        "Azacualpa",
        "Cancasque",
        "Comalapa",
        "Concepción Quezaltepeque",
        "El Carrizal",
        "La Laguna",
        "Las Vueltas",
        "Nombre de Jesús",
        "Nueva Trinidad",
        "Ojos de Agua",
        "Potonico",
        "San Antonio de la Cruz",
        "San Antonio Los Ranchos",
        "San Francisco Lempa",
        "San Isidro Labrador",
        "San José Cancasque",
        "San José Las Flores",
        "San Luis del Carmen",
        "San Miguel de Mercedes",
      ],
    },
  ],
  "05": [
    {
      codigo: "23",
      nombre: "LA LIBERTAD NORTE",
      value: "23",
      label: "LA LIBERTAD NORTE",
      distritos: ["Quezaltepeque", "San Matías", "San Pablo Tacachico"],
    },
    {
      codigo: "24",
      nombre: "LA LIBERTAD CENTRO",
      value: "24",
      label: "LA LIBERTAD CENTRO",
      distritos: ["San Juan Opico", "Ciudad Arce"],
    },
    {
      codigo: "25",
      nombre: "LA LIBERTAD OESTE",
      value: "25",
      label: "LA LIBERTAD OESTE",
      distritos: ["Colón", "Jayaque", "Sacacoyo", "Tepecoyo", "Talnique"],
    },
    {
      codigo: "26",
      nombre: "LA LIBERTAD ESTE",
      value: "26",
      label: "LA LIBERTAD ESTE",
      distritos: [
        "Antiguo Cuscatlán",
        "Huizúcar",
        "Nuevo Cuscatlán",
        "San José Villanueva",
        "Zaragoza",
      ],
    },
    {
      codigo: "27",
      nombre: "LA LIBERTAD COSTA",
      value: "27",
      label: "LA LIBERTAD COSTA",
      distritos: ["Chiltiupán", "Jicalapa", "La Libertad", "Tamanique", "Teotepeque"],
    },
    {
      codigo: "28",
      nombre: "LA LIBERTAD SUR",
      value: "28",
      label: "LA LIBERTAD SUR",
      distritos: ["Santa Tecla", "Comasagua"],
    },
  ],
  "06": [
    {
      codigo: "20",
      nombre: "SAN SALVADOR NORTE",
      value: "20",
      label: "SAN SALVADOR NORTE",
      distritos: ["Aguilares", "El Paisnal", "Guazapa"],
    },
    {
      codigo: "21",
      nombre: "SAN SALVADOR OESTE",
      value: "21",
      label: "SAN SALVADOR OESTE",
      distritos: ["Apopa", "Nejapa"],
    },
    {
      codigo: "22",
      nombre: "SAN SALVADOR ESTE",
      value: "22",
      label: "SAN SALVADOR ESTE",
      distritos: ["Ilopango", "San Martín", "Soyapango", "Tonacatepeque"],
    },
    {
      codigo: "23",
      nombre: "SAN SALVADOR CENTRO",
      value: "23",
      label: "SAN SALVADOR CENTRO",
      distritos: ["San Salvador", "Mejicanos", "Ayutuxtepeque", "Cuscatancingo", "Delgado"],
    },
    {
      codigo: "24",
      nombre: "SAN SALVADOR SUR",
      value: "24",
      label: "SAN SALVADOR SUR",
      distritos: [
        "Panchimalco",
        "Rosario de Mora",
        "San Marcos",
        "Santo Tomás",
        "Santiago Texacuangos",
      ],
    },
  ],
  "07": [
    {
      codigo: "17",
      nombre: "CUSCATLAN NORTE",
      value: "17",
      label: "CUSCATLAN NORTE",
      distritos: [
        "Suchitoto",
        "San José Guayabal",
        "Oratorio de Concepción",
        "San Bartolomé Perulapía",
        "San Pedro Perulapán",
      ],
    },
    {
      codigo: "18",
      nombre: "CUSCATLAN SUR",
      value: "18",
      label: "CUSCATLAN SUR",
      distritos: [
        "Cojutepeque",
        "Candelaria",
        "El Carmen",
        "El Rosario",
        "Monte San Juan",
        "San Cristóbal",
        "San Rafael Cedros",
        "San Ramón",
        "Santa Cruz Analquito",
        "Santa Cruz Michapa",
        "Tenancingo",
      ],
    },
  ],
  "08": [
    {
      codigo: "23",
      nombre: "LA PAZ OESTE",
      value: "23",
      label: "LA PAZ OESTE",
      distritos: [
        "Cuyultitán",
        "Olocuilta",
        "San Juan Talpa",
        "San Luis Talpa",
        "San Pedro Masahuat",
        "Tapalhuaca",
        "San Francisco Chinameca",
      ],
    },
    {
      codigo: "24",
      nombre: "LA PAZ CENTRO",
      value: "24",
      label: "LA PAZ CENTRO",
      distritos: [
        "El Rosario",
        "Jerusalén",
        "Mercedes La Ceiba",
        "Paraíso de Osorio",
        "San Antonio Masahuat",
        "San Emigdio",
        "San Juan Tepezontes",
        "San Luis La Herradura",
        "San Miguel Tepezontes",
        "San Pedro Nonualco",
        "Santa María Ostuma",
      ],
    },
    {
      codigo: "25",
      nombre: "LA PAZ ESTE",
      value: "25",
      label: "LA PAZ ESTE",
      distritos: ["San Juan Nonualco", "San Rafael Obrajuelo", "Zacatecoluca"],
    },
  ],
  "09": [
    {
      codigo: "10",
      nombre: "CABAÑAS OESTE",
      value: "10",
      label: "CABAÑAS OESTE",
      distritos: ["Ilobasco", "Tejutepeque", "Jutiapa", "Cinquera"],
    },
    {
      codigo: "11",
      nombre: "CABAÑAS ESTE",
      value: "11",
      label: "CABAÑAS ESTE",
      distritos: ["Sensuntepeque", "Victoria", "Dolores", "Guacotecti", "San Isidro"],
    },
  ],
  "10": [
    {
      codigo: "14",
      nombre: "SAN VICENTE NORTE",
      value: "14",
      label: "SAN VICENTE NORTE",
      distritos: [
        "Apastepeque",
        "Santa Clara",
        "San Ildefonso",
        "San Esteban Catarina",
        "San Sebastián",
        "San Lorenzo",
        "Santo Domingo",
      ],
    },
    {
      codigo: "15",
      nombre: "SAN VICENTE SUR",
      value: "15",
      label: "SAN VICENTE SUR",
      distritos: [
        "San Vicente",
        "Guadalupe",
        "Verapaz",
        "Nuevo Tepetitán",
        "Tecoluca",
        "San Cayetano Istepeque",
      ],
    },
  ],
  "11": [
    {
      codigo: "24",
      nombre: "USULUTAN NORTE",
      value: "24",
      label: "USULUTAN NORTE",
      distritos: [
        "Santiago de María",
        "Alegría",
        "Berlín",
        "Mercedes Umaña",
        "Jucuapa",
        "El Triunfo",
        "Estanzuelas",
        "San Buenaventura",
        "Nueva Granada",
      ],
    },
    {
      codigo: "25",
      nombre: "USULUTAN ESTE",
      value: "25",
      label: "USULUTAN ESTE",
      distritos: [
        "Usulután",
        "Jucuarán",
        "San Dionisio",
        "Concepción Batres",
        "Santa María",
        "Ereguayquín",
        "Tecapán",
        "California",
        "Ozatlán",
        "Santa Elena",
      ],
    },
    {
      codigo: "26",
      nombre: "USULUTAN OESTE",
      value: "26",
      label: "USULUTAN OESTE",
      distritos: ["Jiquilisco", "Puerto El Triunfo", "San Agustín", "San Francisco Javier"],
    },
  ],
  "12": [
    {
      codigo: "21",
      nombre: "SAN MIGUEL NORTE",
      value: "21",
      label: "SAN MIGUEL NORTE",
      distritos: [
        "Ciudad Barrios",
        "Sesori",
        "Nuevo Edén de San Juan",
        "San Gerardo",
        "San Luis de la Reina",
        "Carolina",
        "San Antonio del Mosco",
        "Chapeltique",
      ],
    },
    {
      codigo: "22",
      nombre: "SAN MIGUEL CENTRO",
      value: "22",
      label: "SAN MIGUEL CENTRO",
      distritos: [
        "San Miguel",
        "Comacarán",
        "Uluazapa",
        "Moncagua",
        "Quelepa",
        "Chirilagua",
      ],
    },
    {
      codigo: "23",
      nombre: "SAN MIGUEL OESTE",
      value: "23",
      label: "SAN MIGUEL OESTE",
      distritos: [
        "Chinameca",
        "Nueva Guadalupe",
        "Lolotique",
        "San Rafael Oriente",
        "El Tránsito",
        "San Jorge",
      ],
    },
  ],
  "13": [
    {
      codigo: "27",
      nombre: "MORAZAN NORTE",
      value: "27",
      label: "MORAZAN NORTE",
      distritos: [
        "Arambala",
        "Cacaopera",
        "Corinto",
        "El Rosario",
        "Joateca",
        "Jocoaitique",
        "Meanguera",
        "Perquín",
        "San Fernando",
        "San Isidro",
        "Torola",
      ],
    },
    {
      codigo: "28",
      nombre: "MORAZAN SUR",
      value: "28",
      label: "MORAZAN SUR",
      distritos: [
        "San Francisco Gotera",
        "Guatajiagua",
        "Delicias de Concepción",
        "El Divisadero",
        "Jocoro",
        "Lolotiquillo",
        "Osicala",
        "Sensembra",
        "Sociedad",
        "San Carlos",
        "San Simón",
        "Chilanga",
        "Yoloaiquín",
      ],
    },
  ],
  "14": [
    {
      codigo: "19",
      nombre: "LA UNION NORTE",
      value: "19",
      label: "LA UNION NORTE",
      distritos: [
        "Anamorós",
        "Bolívar",
        "Concepción de Oriente",
        "El Carmen",
        "El Sauce",
        "Lislique",
        "Nueva Esparta",
        "Pasaquina",
        "Polorós",
        "San Alejo",
        "Yucuaiquín",
      ],
    },
    {
      codigo: "20",
      nombre: "LA UNION SUR",
      value: "20",
      label: "LA UNION SUR",
      distritos: [
        "La Unión",
        "Conchagua",
        "El Tamarindo",
        "Intipucá",
        "Meanguera del Golfo",
        "San José",
        "Yayantique",
      ],
    },
  ],
};

/**
 * Retorna los municipios correspondientes a un departamento (CAT-013 2024).
 */
export function getMunicipios(departamento: string): MunicipioInfo[] {
  return MUNICIPIOS_POR_DEPARTAMENTO[departamento] ?? [];
}

export interface DistritoItem {
  nombre: string;
  municipioCodigo: string;
  municipioNombre: string;
}

/**
 * Retorna los distritos correspondientes a un departamento o a un municipio específico.
 */
export function getDistritos(
  departamento: string,
  municipioCodigo?: string
): DistritoItem[] {
  const municipios = MUNICIPIOS_POR_DEPARTAMENTO[departamento] ?? [];
  const list: DistritoItem[] = [];

  for (const m of municipios) {
    if (!municipioCodigo || m.codigo === municipioCodigo) {
      for (const d of m.distritos) {
        list.push({
          nombre: d,
          municipioCodigo: m.codigo,
          municipioNombre: m.nombre,
        });
      }
    }
  }

  return list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Busca a qué municipio pertenece un distrito dentro de un departamento.
 */
export function findMunicipioByDistrito(
  departamento: string,
  distritoNombre: string
): MunicipioInfo | undefined {
  const municipios = MUNICIPIOS_POR_DEPARTAMENTO[departamento] ?? [];
  const query = distritoNombre.trim().toLowerCase();
  return municipios.find((m) =>
    m.distritos.some((d) => d.toLowerCase() === query)
  );
}

/**
 * Obtiene la etiqueta amigable de un departamento dado su código.
 */
export function getDepartamentoLabel(departamentoCodigo?: string | null): string {
  if (!departamentoCodigo) return "N/D";
  const found = DEPARTAMENTOS.find((d) => d.value === departamentoCodigo);
  return found ? `${found.label} (${found.value})` : departamentoCodigo;
}

/**
 * Obtiene la etiqueta amigable de un municipio dado su código y departamento.
 */
export function getMunicipioLabel(
  departamentoCodigo?: string | null,
  municipioCodigo?: string | null
): string {
  if (!municipioCodigo) return "N/D";
  if (!departamentoCodigo) return municipioCodigo;
  const municipios = MUNICIPIOS_POR_DEPARTAMENTO[departamentoCodigo] ?? [];
  const found = municipios.find((m) => m.codigo === municipioCodigo);
  return found ? `${found.nombre} (${found.codigo})` : municipioCodigo;
}
