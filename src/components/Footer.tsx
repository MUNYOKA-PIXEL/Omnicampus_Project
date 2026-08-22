import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-usiu-dark-blue text-primary-foreground" style={{ padding: "3rem 0 1.5rem" }}>
      <div className="max-w-[1200px] mx-auto grid grid-cols-3 gap-12 px-12">
        <div>
          <h4 className="text-accent mb-6">About OmniCampus</h4>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">
            OmniCampus is a comprehensive campus management system designed for students and administrators.
          </p>
        </div>
        <div>
          <h4 className="text-accent mb-6">Quick Links</h4>
          <ul className="space-y-4">
            <li><Link to="/library" className="text-primary-foreground/80 hover:text-accent transition-colors duration-300">Library</Link></li>
            <li><Link to="/lost-found" className="text-primary-foreground/80 hover:text-accent transition-colors duration-300">Lost & Found</Link></li>
            <li><Link to="/clubs" className="text-primary-foreground/80 hover:text-accent transition-colors duration-300">Student Clubs</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-accent mb-6">Contact</h4>
          <ul className="space-y-4">
            <li className="text-primary-foreground/80">support@omnicampus.edu</li>
            <li className="text-primary-foreground/80">+254 700 123 456</li>
          </ul>
        </div>
      </div>
      <div className="text-center pt-12 mt-12 border-t border-primary-foreground/20 text-primary-foreground/60">
        © 2025 OmniCampus. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
