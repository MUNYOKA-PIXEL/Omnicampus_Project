import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="bg-card border-b-2 border-accent sticky top-0 z-[1000] shadow-usiu" style={{ padding: "1rem 3rem" }}>
      <div className="max-w-[1400px] mx-auto flex justify-between items-center">
        <Link to="/" className="text-[1.8rem] font-bold text-primary">
          OmniCampus
        </Link>
        <div className="flex gap-8 items-center">
          <Link
            to="/dashboard"
            className={`font-medium transition-colors duration-300 ${
              location.pathname === "/dashboard" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/library"
            className={`font-medium transition-colors duration-300 ${
              location.pathname === "/library" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`}
          >
            Library
          </Link>
          <Link
            to="/lost-found"
            className={`font-medium transition-colors duration-300 ${
              location.pathname === "/lost-found" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`}
          >
            Lost & Found
          </Link>
          <Link
            to="/clubs"
            className={`font-medium transition-colors duration-300 ${
              location.pathname === "/clubs" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`}
          >
            Clubs
          </Link>
          <Link
            to="/assistant"
            className={`font-medium transition-colors duration-300 ${
              location.pathname === "/assistant" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`}
          >
            AI Assistant
          </Link>
          <Link
            to="/login"
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-usiu-dark-blue transition-colors duration-300"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
