import type { Role } from "@/modules/identity/domain/roles";

export type NavIcon = "home" | "calendarPlus" | "calendar" | "messages" | "shield" | "user" | "clock" | "users" | "stethoscope" | "tag" | "scroll";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Chave de contador exibido ao lado (ex.: mensagens não lidas). */
  counter?: "unreadMessages" | "pendingRequests";
  exact?: boolean;
};

export const NAVIGATION: Record<Role, NavItem[]> = {
  PATIENT: [
    { href: "/paciente", label: "Início", icon: "home", exact: true },
    { href: "/paciente/agendar", label: "Agendar consulta", icon: "calendarPlus" },
    { href: "/paciente/consultas", label: "Minhas consultas", icon: "calendar" },
    { href: "/paciente/mensagens", label: "Mensagens", icon: "messages", counter: "unreadMessages" },
    { href: "/paciente/privacidade", label: "Privacidade", icon: "shield", counter: "pendingRequests" },
    { href: "/paciente/perfil", label: "Meus dados", icon: "user" },
  ],
  PROFESSIONAL: [
    { href: "/profissional", label: "Início", icon: "home", exact: true },
    { href: "/profissional/agenda", label: "Agenda", icon: "calendar" },
    { href: "/profissional/horarios", label: "Horários de trabalho", icon: "clock" },
    { href: "/profissional/pacientes", label: "Pacientes", icon: "users" },
    { href: "/profissional/mensagens", label: "Mensagens", icon: "messages", counter: "unreadMessages" },
    { href: "/profissional/conta", label: "Minha conta", icon: "user" },
  ],
  ADMIN: [
    { href: "/admin", label: "Visão geral", icon: "home", exact: true },
    { href: "/admin/profissionais", label: "Profissionais", icon: "stethoscope" },
    { href: "/admin/pacientes", label: "Pacientes", icon: "users" },
    { href: "/admin/servicos", label: "Serviços e valores", icon: "tag" },
    { href: "/admin/consultas", label: "Consultas", icon: "calendar" },
    { href: "/admin/auditoria", label: "Auditoria", icon: "scroll" },
    { href: "/admin/conta", label: "Minha conta", icon: "user" },
  ],
};

/** Como cada área se apresenta no topo do menu. */
export const AREA_LABELS: Record<Role, string> = {
  PATIENT: "Área do paciente",
  PROFESSIONAL: "Área do profissional",
  ADMIN: "Administração",
};

export const PUBLIC_NAVIGATION = [
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/valores", label: "Valores" },
  { href: "/equipe", label: "Equipe" },
  { href: "/#privacidade", label: "Sua privacidade" },
] as const;
