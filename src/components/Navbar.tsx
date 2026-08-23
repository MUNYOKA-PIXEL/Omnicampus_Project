import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    ["/dashboard", "Dashboard"],
    ["/library", "Library"],
    ["/lost-found", "Lost & Found"],
    ["/clubs", "Clubs"],
    ["/assistant", "AI Assistant"],
  ];

  const linkClass = (path: string) =>
    `font-medium transition-colors duration-300 ${
      location.pathname === path ? "text-primary" : "text-muted-foreground hover:text-primary"
    }`;

  return (
    <nav className="sticky top-0 z-[1000] border-b-2 border-accent bg-card shadow-usiu">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
        <Link to="/" className="text-2xl font-bold text-primary sm:text-[1.8rem]">
          OmniCampus
        </Link>
        <div className="hidden items-center gap-5 md:flex lg:gap-8">
          {navLinks.map(([path, label]) => (
            <Link key={path} to={path} className={linkClass(path)}>
              {label}
            </Link>
          ))}
          <Link
            to="/login"
            className="rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors duration-300 hover:bg-usiu-dark-blue"
          >
            Login
          </Link>
        </div>
        <button
          type="button"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-md p-2 text-primary hover:bg-muted md:hidden"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {isMenuOpen && (
        <div className="border-t border-border px-4 pb-4 pt-2 md:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-1">
            {navLinks.map(([path, label]) => (
              <Link
                key={path}
                to={path}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-md px-3 py-3 font-medium text-muted-foreground hover:bg-muted hover:text-primary"
              >
                {label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setIsMenuOpen(false)}
              className="mt-2 rounded-md bg-primary px-3 py-3 text-center font-medium text-primary-foreground"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
