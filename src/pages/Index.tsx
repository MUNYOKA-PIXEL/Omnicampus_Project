import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, Search, Users, Bot } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

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

const Index = () => {
  const [stats, setStats] = useState([
    { value: "...", label: "Books Available" },
    { value: "...", label: "Active Clubs" },
    { value: "...", label: "Items Recovered" },
    { value: "...", label: "Students" },
  ]);

  useEffect(() => {
    supabase.rpc("get_public_stats").then(({ data, error }) => {
      if (error || !data?.[0]) {
        setStats((currentStats) => currentStats.map((stat) => ({ ...stat, value: "-" })));
        return;
      }

      const currentStats = data[0];
      setStats([
        { value: currentStats.books_available.toLocaleString(), label: "Books Available" },
        { value: currentStats.active_clubs.toLocaleString(), label: "Active Clubs" },
        { value: currentStats.items_recovered.toLocaleString(), label: "Items Recovered" },
        { value: currentStats.registered_students.toLocaleString(), label: "Students" },
      ]);
    });
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-usiu-dark-blue text-primary-foreground">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-accent">Your campus, in one place</p>
            <h1 className="mb-6 text-5xl font-bold leading-[1.05] text-accent sm:text-6xl">Welcome to OmniCampus</h1>
            <p className="mb-8 max-w-xl text-lg leading-relaxed text-primary-foreground/80 sm:text-xl">Find what you need, stay connected, and make campus life easier from one trusted student platform.</p>
            <div className="flex flex-wrap gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground transition-transform duration-300 hover:-translate-y-0.5"
            >
              Join OmniCampus <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center rounded-md border border-primary-foreground/40 px-6 py-3 font-medium transition-colors duration-300 hover:border-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              Explore services
            </a>
            </div>
          </div>

          <div className="relative overflow-hidden border border-primary-foreground/20 bg-primary-foreground/10 p-5 shadow-2xl backdrop-blur-sm sm:p-7">
            <div className="mb-8 flex items-center justify-between border-b border-primary-foreground/15 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/60">Today on campus</p>
                <p className="mt-1 text-lg font-semibold">Everything within reach</p>
              </div>
              <CalendarDays className="h-7 w-7 text-accent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Library", "Books ready", BookOpen],
                ["Clubs", "15+ communities", Users],
                ["Lost & Found", "Find it faster", Search],
                ["Assistant", "Answers on demand", Bot],
              ].map(([label, detail, Icon]) => (
                <div key={label as string} className="border border-primary-foreground/15 bg-primary-foreground/10 p-4">
                  <Icon className="mb-5 h-5 w-5 text-accent" />
                  <p className="font-semibold">{label as string}</p>
                  <p className="mt-1 text-sm text-primary-foreground/60">{detail as string}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-primary-foreground/15 pt-4 text-sm">
              <span className="text-primary-foreground/60">One platform. Five services.</span>
              <span className="font-semibold text-accent">USIU campus</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[1400px] px-6 py-16 sm:px-10 lg:px-12 lg:py-20">
        <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Built for campus life</p>
            <h2 className="text-3xl font-bold text-primary sm:text-4xl">Your everyday essentials</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">One simple place to manage the details that keep your day moving.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="border border-border bg-card p-7 shadow-usiu transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-usiu-card"
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
      <section className="bg-primary px-6 py-12 text-primary-foreground sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-y-8 text-center lg:grid-cols-4">
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
