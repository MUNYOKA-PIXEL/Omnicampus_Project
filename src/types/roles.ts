export type AppRole = "superadmin" | "libadmin" | "medadmin" | "clubadmin" | "student";

export const ADMIN_ROLES: AppRole[] = ["superadmin", "libadmin", "medadmin", "clubadmin"];

export const isAdminRole = (role: AppRole | null): boolean => {
  return role !== null && ADMIN_ROLES.includes(role);
};

export const getRoleDashboardPath = (role: AppRole | null): string => {
  switch (role) {
    case "superadmin":
      return "/dashboard";
    case "libadmin":
      return "/library";
    case "medadmin":
      return "/medical";
    case "clubadmin":
      return "/clubs";
    case "student":
    default:
      return "/dashboard";
  }
};

export const getRoleLabel = (role: AppRole | null): string => {
  switch (role) {
    case "superadmin":
      return "Super Admin";
    case "libadmin":
      return "Library Admin";
    case "medadmin":
      return "Medical Admin";
    case "clubadmin":
      return "Club Admin";
    case "student":
      return "Student";
    default:
      return "User";
  }
};
