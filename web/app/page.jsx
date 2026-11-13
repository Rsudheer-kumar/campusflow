"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Box, Shield, Zap, Sparkles, Building2, Calendar, Users, Map, CheckCircle2 } from "lucide-react";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingScene } from "@/components/landing/landing-scene";
import { ResourceCardsGrid } from "@/components/landing/resource-cards-grid";
import { Button, Text3DFlip, ShinyButton } from "@/components/ui";
// Fade up settings
const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (custom) => ({
        opacity: 1,
        y: 0,
        transition: { delay: custom * 0.1, duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }
    })
};
// Reusable viewport configurations for repeated animations
const viewPortConfig = { once: true, amount: 0.15, margin: "0px" };
const viewPortReveal = { once: true, amount: 0.15, margin: "0px" };

const RESOURCE_FEATURES = [
  {
    icon: <Box className="h-6 w-6 text-cyan-400" />,
    bg: "bg-cyan-400/10",
    accentColor: "#38bdf8",
    title: "Digital Twin 3D View",
    tag: "Spatial Intelligence",
    desc: "Navigate visually. See resource availability mapped directly to specific buildings and floors in real-time.",
    linkText: "Explore Campus Twin",
  },
  {
    icon: <Building2 className="h-6 w-6 text-violet-400" />,
    bg: "bg-violet-400/10",
    accentColor: "#a78bfa",
    title: "Facility Management",
    tag: "Infrastructure",
    desc: "Manage everything from large lecture halls and sports complexes to individual workstations and specialized equipment.",
    linkText: "View Facilities",
  },
  {
    icon: <Zap className="h-6 w-6 text-emerald-400" />,
    bg: "bg-emerald-400/10",
    accentColor: "#34d399",
    title: "Real-time Availability",
    tag: "Instant Sync",
    desc: "Prevent double-bookings effortlessly. Status updates instantly across the platform as soon as a reservation is made.",
    linkText: "Check Schedules",
  },
  {
    icon: <Calendar className="h-6 w-6 text-amber-500" />,
    bg: "bg-amber-500/10",
    accentColor: "#f59e0b",
    title: "Smart Scheduling",
    tag: "Automated Routing",
    desc: "Automated conflict resolution and intelligent suggestions for alternative spaces tailored to your requirements.",
    linkText: "Book Timeslots",
  },
  {
    icon: <Users className="h-6 w-6 text-cyan-400" />,
    bg: "bg-cyan-400/10",
    accentColor: "#38bdf8",
    title: "Role-based Access",
    tag: "Governance",
    desc: "Granular permissions for students, faculty, and administrative staff ensuring resources are utilized correctly.",
    linkText: "Manage Roles",
  },
  {
    icon: <Shield className="h-6 w-6 text-rose-400" />,
    bg: "bg-rose-400/10",
    accentColor: "#fb7185",
    title: "Enterprise Security",
    tag: "Data Privacy",
    desc: "Built with secure cloud infrastructure and protected authentication to safeguard institutional data and privacy.",
    linkText: "Review Security",
  },
];

export default function LandingPage() {
    return (<div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden transition-colors duration-200">
      <LandingNavbar />

      <main>
        {/* HERO SECTION */}
        <section className="relative h-[100dvh] w-full flex items-center justify-center overflow-hidden">
          {/* 3D Background */}
          <div className="absolute inset-0 z-0">
            <LandingScene />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-[1] w-full lg:w-2/3 pointer-events-none"/>

          {/* Hero Content Overlay */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center h-full pt-16 pointer-events-none">

            <div className="w-full md:w-3/5 lg:w-1/2 flex flex-col items-start text-left mt-10 md:mt-0 pointer-events-auto">
              <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full surface border border-border mb-6 pointer-events-auto shadow-[0_0_20px_rgba(79,140,255,0.1)]">
                <Sparkles className="h-4 w-4 text-primary"/>
                <span className="text-xs md:text-sm font-medium tracking-wide">Next-Gen Campus Platform</span>
              </motion.div>

              <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp} className="w-full">
                <Text3DFlip
                  as="h1"
                  className="font-[family-name:var(--font-serif-display)] text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 drop-shadow-sm leading-[1.1]"
                  textClassName="text-foreground"
                  flipTextClassName="text-primary"
                  rotateDirection="top"
                  staggerDuration={0.03}
                  staggerFrom="first"
                  transition={{ type: "spring", damping: 25, stiffness: 160 }}
                >
                  Campus resource <br className="hidden md:block"/>
                  management,<br className="hidden md:block"/>
                  reimagined.
                </Text3DFlip>
              </motion.div>

              <motion.p custom={3} initial="hidden" animate="visible" variants={fadeUp} className="charm-regular text-lg md:text-2xl text-muted/90 max-w-xl mb-10 drop-shadow-sm leading-relaxed">
                Navigate your university through an interactive digital twin. Book laboratories, seminar halls, and equipment from one intelligent, unified interface.
              </motion.p>

              <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pointer-events-auto">
                <Link href="/signin?tab=register" className="w-full sm:w-auto">
                  <ShinyButton className="group h-14 px-8 text-base bg-primary text-white border-primary shadow-[0_4px_20px_rgba(66,107,139,0.35)] hover:bg-primary-bright w-full sm:w-auto">
                    Explore Campus
                    <ArrowRight className="ml-1 h-5 w-5 transition-transform group-hover:translate-x-1"/>
                  </ShinyButton>
                </Link>
                <Link href="#how-it-works" className="w-full sm:w-auto">
                  <ShinyButton className="h-14 px-8 text-base bg-surface text-foreground border-border hover:border-primary/50 shadow-sm w-full sm:w-auto">
                    See How It Works
                  </ShinyButton>
                </Link>
              </motion.div>
            </div>

            {/* The right side is intentionally left empty so the 3D campus breathes */}
            <div className="hidden md:block w-full md:w-2/5 lg:w-1/2"></div>
          </div>

          <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none"/>
        </section>

        {/* FEATURES SECTION (Scroll-driven 3D Orbit Carousel) */}
        <section id="features" className="relative z-20 bg-background overflow-visible">
          <ResourceCardsGrid
            meta="01 / Unified Platform"
            title="Unified platform for all resources"
            subtitle="Replace fragmented systems with one intuitive, modern ecosystem designed to optimize space and equipment utilization."
            items={RESOURCE_FEATURES}
          />
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-24 relative z-20 bg-surface-2/60">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"/>

          <div className="container mx-auto px-4 md:px-6">
            <motion.div initial="hidden" whileInView="visible" viewport={viewPortReveal} custom={1} variants={fadeUp} className="text-center mb-20 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight text-foreground">How it works</h2>
              <p className="text-lg md:text-xl text-muted">
                Secure a facility or vital equipment block in three intuitive steps.
              </p>
            </motion.div>

            <div className="relative flex flex-col md:flex-row items-start justify-between gap-12 max-w-5xl mx-auto">

              {/* Desktop Connecting Line */}
              <div className="hidden md:block absolute top-[44px] left-[15%] right-[15%] h-[2px] bg-border z-0">
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={viewPortReveal} transition={{ duration: 1.5, ease: "easeInOut" }} className="h-full bg-primary origin-left"/>
              </div>

              {[
            {
                icon: <Map className="h-6 w-6 text-primary"/>,
                title: "Find Space",
                desc: "Use the map or advanced search to pinpoint the facility that meets your specific technical or capacity needs."
            },
            {
                icon: <Calendar className="h-6 w-6 text-primary"/>,
                title: "Select Time",
                desc: "Check real-time availability, select a timeslot, and submit any necessary departmental approval requests."
            },
            {
                icon: <CheckCircle2 className="h-6 w-6 text-primary"/>,
                title: "Confirm & Use",
                desc: "Receive instant confirmation and digital access keys to proceed seamlessly into your booked environment."
            }
        ].map((item, i) => (<motion.div key={i} initial="hidden" whileInView="visible" viewport={viewPortConfig} custom={i + 2} variants={fadeUp} className="flex-1 flex flex-col items-center text-center relative z-10 w-full">
                  <div className="h-[88px] w-[88px] rounded-full bg-surface border-[4px] border-surface-2 flex items-center justify-center mb-6 shadow-md">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 tracking-tight text-foreground">{item.title}</h3>
                  <p className="text-muted leading-relaxed max-w-[280px]">{item.desc}</p>
                </motion.div>))}
            </div>
          </div>

          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"/>
        </section>

        {/* CTA */}
        <section className="py-32 relative z-20 bg-background overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none"/>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50"/>

          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <motion.div initial="hidden" whileInView="visible" viewport={viewPortReveal} custom={1} variants={fadeUp}>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-foreground">Ready to streamline your campus?</h2>
              <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10">
                Deploy a scalable space management system designed to prevent conflicts, maximize utilization, and provide visibility across all university facilities.
              </p>
              <Link href="/signin?tab=register">
                <Button size="lg" variant="primary" className="h-14 px-10 text-lg shadow-[0_4px_20px_rgba(66,107,139,0.3)] group">
                  Enter Campus Digital Twin
                  <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1"/>
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-background py-12 border-t border-border relative z-20">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all">
            <div className="h-6 w-6 rounded-md bg-primary/20 border border-primary/50 flex items-center justify-center">
              <div className="h-2 w-2 bg-primary rounded-sm shadow-[0_0_10px_var(--primary)]"/>
            </div>
            <span className="font-semibold text-foreground tracking-tight">CampusFlow</span>
          </div>

          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} Campus Booking Platform.
          </p>

          <div className="flex gap-6 text-sm font-medium text-muted">
            <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-primary transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>);
}
