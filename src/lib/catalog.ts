import { supabase, friendlyError } from '@/lib/supabaseClient';

export interface CatalogItem {
  id: string;
  name: string;
}
export interface Career extends CatalogItem {
  area: string;
}
export interface Subject extends CatalogItem {
  careerId: string;
}
export interface Interest extends CatalogItem {
  category: string;
}
export interface Catalog {
  campuses: CatalogItem[];
  careers: Career[];
  subjects: Subject[];
  interests: Interest[];
}

/** Catálogo local para el modo demo (en modo real todo viene de Supabase). */
const demoCareers: Career[] = [
  { id: 'isc', name: 'Ingeniería en Sistemas Computacionales', area: 'Ingeniería' },
  { id: 'bio', name: 'Ingeniería Biomédica', area: 'Ingeniería y Salud' },
  { id: 'dg', name: 'Licenciatura en Diseño Gráfico', area: 'Diseño y Arte' },
  { id: 'med', name: 'Médico Cirujano', area: 'Ciencias de la Salud' },
];
const demoSubjectsByCareer: Record<string, string[]> = {
  isc: ['Estructura de Datos', 'Sistemas Distribuidos', 'Inteligencia Artificial', 'Bases de Datos Avanzadas', 'Redes de Computadoras', 'Compiladores'],
  bio: ['Bioinstrumentación', 'Procesamiento de Bioseñales', 'Biomecánica', 'Fisiología para Ingenieros', 'Sensores Médicos'],
  dg: ['Tipografía Editorial', 'Identidad Corporativa', 'Diseño de Interfaces UI/UX', 'Fotografía y Semiótica', 'Animación Digital'],
  med: ['Anatomía Humana II', 'Farmacología Clínica', 'Fisiopatología', 'Microbiología Médica', 'Bioética Médica'],
};
const demoInterests: Record<string, string[]> = {
  Tecnología: ['Programación', 'Inteligencia Artificial', 'Videojuegos', 'Robótica', 'Ciberseguridad'],
  Arte: ['Fotografía 35mm', 'Cineclub', 'Pintura', 'Lectura', 'Museos', 'Escritura Creativa'],
  Música: ['Música Indie', 'Rock en Español', 'Jazz', 'Pop', 'Electrónica', 'Tocar Guitarra'],
  Deportes: ['Básquetbol', 'Fútbol', 'Gimnasio', 'Running', 'Yoga', 'Senderismo', 'Natación', 'Voleibol'],
  'Estilo de Vida': ['Café de Especialidad', 'Matcha', 'Viajar', 'Voluntariado', 'Perros y Gatos', 'Juegos de Mesa', 'Cocinar', 'Ajedrez', 'Anime y Manga', 'Podcasts', 'Series y Cine'],
};

export const DEMO_CATALOG: Catalog = {
  campuses: [
    { id: 'central', name: 'Campus Central' },
    { id: 'sur', name: 'Campus Sur' },
  ],
  careers: demoCareers,
  subjects: Object.entries(demoSubjectsByCareer).flatMap(([careerId, names]) =>
    names.map((name) => ({ id: `${careerId}:${name}`, name, careerId }))
  ),
  interests: Object.entries(demoInterests).flatMap(([category, names]) =>
    names.map((name) => ({ id: name, name, category }))
  ),
};

/** Carga campus, carreras, materias e intereses de la universidad del usuario. */
export async function loadCatalog(universityId?: string): Promise<Catalog> {
  let campusesQ = supabase.from('campuses').select('id, name');
  let careersQ = supabase.from('careers').select('id, name, area');
  if (universityId) {
    campusesQ = campusesQ.eq('university_id', universityId);
    careersQ = careersQ.eq('university_id', universityId);
  }

  const [campuses, careers, interests] = await Promise.all([
    campusesQ.order('name'),
    careersQ.order('name'),
    supabase.from('interests').select('id, name, category').order('category').order('name'),
  ]);

  const firstError = campuses.error || careers.error || interests.error;
  if (firstError) throw new Error(friendlyError(firstError, 'No se pudo cargar el catálogo.'));

  const careerIds = (careers.data || []).map((c) => c.id);
  const subjects = careerIds.length
    ? await supabase.from('subjects').select('id, name, career_id').in('career_id', careerIds).order('name')
    : { data: [], error: null };
  if (subjects.error) throw new Error(friendlyError(subjects.error, 'No se pudieron cargar las materias.'));

  return {
    campuses: campuses.data || [],
    careers: careers.data || [],
    subjects: (subjects.data || []).map((s) => ({ id: s.id, name: s.name, careerId: s.career_id })),
    interests: interests.data || [],
  };
}
