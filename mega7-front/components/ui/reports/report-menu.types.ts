export type ReportMenuNode = {
  id: number;
  nombre: string;
  titulo: boolean;
  color?: string | null;
  icono?: string | null;
  url?: string | null;
  idPadre?: number | null;
  orden?: number;
  role?: string | null;
  children: ReportMenuNode[];
};