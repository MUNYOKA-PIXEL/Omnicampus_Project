import { Link } from "react-router-dom";
import { BookOpen, Search, Users, Bot } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const features = [
  {
    icon: BookOpen,
    title: "Library Management",
    description: "Browse books, check availability, and manage loans",
    link: "/library",
    linkText: "Explore Library →",
  },
  {
    icon: Search,
    title: "Lost & Found",
    description: "Report lost items and find what you've misplaced",
    link: "/lost-found",
    linkText: "View Items →",
  },
  {
    icon: Users,
    title: "Student Clubs",
    description: "Join clubs, attend events, and connect with peers",
    link: "/clubs",
    linkText: "Discover Clubs →",
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description: "Get recommendations and answers to your questions",
    link: "/assistant",
    linkText: "Try AI →",
  },
];

const stats = [
  { value: "2,500+", label: "Books Available" },
  { value: "15+", label: "Active Clubs" },
  { value: "350+", label: "Items Recovered" },
  { value: "1,200+", label: "Students" },
];

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-usiu-dark-blue py-12 text-center text-primary-foreground">
        <div className="max-w-[800px] mx-auto p-12">
          <h1 className="text-[3.5rem] font-bold mb-6 text-accent">Welcome to OmniCampus</h1>
          <p className="text-[1.2rem] mb-8 opacity-90">Your all-in-one campus management system</p>
          <div className="flex gap-6 justify-center">
            <Link
              to="/register"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-usiu-dark-blue hover:-translate-y-0.5 transition-all duration-300 inline-flex items-center gap-2"
              style={{ boxShadow: "0 5px 15px rgba(0,51,102,0.3)" }}
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="bg-transparent text-primary-foreground border border-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary-foreground hover:text-primary transition-all duration-300"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="p-12 max-w-[1400px] mx-auto">
        <h2 className="text-center text-[2.5rem] font-bold mb-12 text-primary">Campus Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-xl p-8 shadow-usiu hover:-translate-y-1 hover:shadow-usiu-card hover:border-accent transition-all duration-300"
              >
                <Icon className="w-10 h-10 text-primary mb-6" />
                <h3 className="text-[1.3rem] font-semibold mb-4 text-primary">{feature.title}</h3>
                <p className="text-muted-foreground mb-6">{feature.description}</p>
                <Link to={feature.link} className="text-primary font-medium hover:text-accent transition-colors duration-300">
                  {feature.linkText}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary p-12 text-primary-foreground">
        <div className="max-w-[1200px] mx-auto grid grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span className="text-[2.5rem] font-bold text-accent block">{stat.value}</span>
              <span className="text-primary-foreground/90 text-base">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
