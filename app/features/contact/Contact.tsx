"use client";

import { useEffect, useRef, useState } from "react";
import { fraunces } from "@/public/fonts/Fraunces";
import LeftSideLabel from "../hero/LeftSideLabel";
import RightSideLabel from "../hero/RightSideLabel";
import ContactAccordion from "./ContactAccordion";
import styles from "./contact.module.css";
import { Mail, Clock, MapPin, Share2, ArrowUpRight } from "lucide-react";

const contactData = [
  {
    index: "01",
    header: "EMAIL",
    icon: <Mail className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: false,
    content: (
      <a href="mailto:amrorapy50@gmail.com" className="text-foreground hover:opacity-70 transition-opacity">
        amrorapy50@gmail.com
      </a>
    ),
  },
  {
    index: "02",
    header: "AVAILABILITY",
    icon: <Clock className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: false,
    content: (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-foreground">Open for new projects</span>
        </div>
        <p className="text-[11px] text-main-gray">Response time: &lt; 24 hours</p>
      </div>
    ),
  },
  {
    index: "03",
    header: "LOCATION",
    icon: <MapPin className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: false,
    content: (
      <div>
        <div className="text-foreground mb-2">Mansoura, Egypt</div>
        <p className="text-[11px] text-main-gray">Working remotely worldwide</p>
      </div>
    ),
  },
  {
    index: "04",
    header: "SOCIALS",
    icon: <Share2 className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: true,
    content: (
      <div className="flex gap-6">
        <a href="https://github.com/Amr-Oraby" target="_blank" rel="noopener noreferrer" className="relative inline-block text-foreground font-medium overflow-hidden group pl-2 pr-2 border-l border-foreground/30 hover:border-foreground transition-colors">
          <span className="relative z-10 group-hover:text-background transition-colors duration-300">GitHub</span>
          <span className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></span>
        </a>
        <a href="https://www.linkedin.com/in/amr-oraby-a87b69366/" target="_blank" rel="noopener noreferrer" className="relative inline-block text-foreground font-medium overflow-hidden group pl-2 pr-2 border-l border-foreground/30 hover:border-foreground transition-colors">
          <span className="relative z-10 group-hover:text-background transition-colors duration-300">LinkedIn</span>
          <span className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></span>
        </a>
        <a href="https://www.facebook.com/amr.rabi.2025" target="_blank" rel="noopener noreferrer" className="relative inline-block text-foreground font-medium overflow-hidden group pl-2 pr-2 border-l border-foreground/30 hover:border-foreground transition-colors">
          <span className="relative z-10 group-hover:text-background transition-colors duration-300">Facebook</span>
          <span className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></span>
        </a>
      </div>
    ),
  },
];

function Contact() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setStatus({ type: "idle", message: "" });

    // Client-side validation check
    if (!name.trim() || !email.trim() || !message.trim() || message.length > 500) {
      setStatus({
        type: "error",
        message: "There was an error sending your message. Please try again.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          _hp: honeypot,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setStatus({
          type: "success",
          message: "Thank you! Your message has been sent successfully.",
        });
        setName("");
        setEmail("");
        setMessage("");
        setHoneypot("");
      } else {
        setStatus({
          type: "error",
          message: "There was an error sending your message. Please try again.",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message: "There was an error sending your message. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const checkImmediateVisibility = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 50 && rect.bottom > 0) {
        setInView(true);
        return true;
      }
      return false;
    };

    if (checkImmediateVisibility()) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      id="contact"
      className={`min-h-[600px] relative py-4 sm:py-15 mb-20 ${inView ? styles.inView : ""}`}
    >
      <div className={` -mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] text-main-gray ${styles.sectionBadge}`}>
        <span className="w-2 h-2 bg-foreground rounded-full mr-3 "></span>
        <span>CONTACT</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 md:gap-8 xl:gap-20 2xl:gap-30 justify-between items-center sm:items-start px-5 sm:px-10 md:px-15 pr-5 sm:pr-14 md:pr-24">
        <LeftSideLabel sectionNum={5} />
        <RightSideLabel />
        
        {/* Left Side: Header & Text */}
        <div className="text w-full sm:max-w-[400px]">
          <div
            className={`${fraunces.className} pt-10 sm:ml-6 -space-y-5 font-light text-foreground`}
          >
            <div className={styles.lineMask}>
              <h1 className={`text-[50px] xl:text-[60px] ${styles.headingLine1}`}>Let's work</h1>
            </div>
            <div className={styles.lineMask}>
              <h1 className={`text-[50px] xl:text-[60px] ${styles.headingLine2}`}>
                <span className="italic -skew-x-6">together</span>.
              </h1>
            </div>
          </div>
          
          <div className="mt-10 space-y-10 sm:ml-6 hidden sm:block">
            <div className={`w-11.5 h-px bg-main-gray/30 ${styles.hairline}`}></div>
            <p className={`text-main-gray text-sm max-w-[270px] ${styles.manifestoText}`}>
              I am currently available for freelance work. If you have a project in mind or just want to say hi, feel free to reach out.
            </p>
            <div className={`flex gap-3 items-center ${styles.kicker}`}>
              <div className="w-11.5 h-px bg-main-gray/30"></div>
              <div className="text-main-gray font-bold text-xs">
                GET IN TOUCH
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form + Cards */}
        <div className="flex-1 w-full flex flex-col xl:flex-row gap-10 mt-10 sm:mt-10">
          
          {/* Form */}
          <div className="flex-1 min-w-[300px]">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
              <div className={`flex flex-col gap-2 ${styles.formField} ${styles.formField1}`}>
                <label className="text-[10px] tracking-[0.25em] uppercase text-main-gray">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="border border-border bg-transparent px-4 py-3 outline-none focus:border-foreground transition-colors text-foreground text-sm"
                />
              </div>
              <div className={`flex flex-col gap-2 ${styles.formField} ${styles.formField2}`}>
                <label className="text-[10px] tracking-[0.25em] uppercase text-main-gray">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="hello@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="border border-border bg-transparent px-4 py-3 outline-none focus:border-foreground transition-colors text-foreground text-sm"
                />
              </div>
              <div className={`flex flex-col gap-2 ${styles.formField} ${styles.formField3}`}>
                <div className="flex justify-between">
                  <label className="text-[10px] tracking-[0.25em] uppercase text-main-gray">
                    Message
                  </label>
                  <span className="text-[10px] text-main-gray">{message.length}/500</span>
                </div>
                <textarea
                  placeholder="Tell me about your project..."
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  disabled={isSubmitting}
                  required
                  className="border border-border bg-transparent px-4 py-3 outline-none focus:border-foreground transition-colors text-foreground text-sm resize-none"
                ></textarea>
              </div>

              {/* Honeypot field for bot protection (hidden from humans and screen readers) */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  name="_hp"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {status.type !== "idle" && (
                <div
                  className="text-xs p-3.5 border border-border bg-foreground/5 text-foreground flex items-center gap-2.5 transition-all duration-300"
                  role={status.type === "error" ? "alert" : "status"}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                  <span className="text-xs tracking-wide">{status.message}</span>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting}
                className={`cursor-pointer group flex h-10 sm:h-[52px] w-fit items-center rounded-none border border-foreground/20 hover:border-foreground bg-transparent pl-5 sm:pl-6 pr-1.5 sm:pr-2 transition-all hover:bg-foreground/5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed ${styles.formField} ${styles.formButton}`}
              >
                <span className="mr-4 sm:mr-6 text-[10px] sm:text-[12px] font-bold text-foreground uppercase tracking-[0.25em]">
                  {isSubmitting ? "Sending..." : "Send Message"}
                </span>
                <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-none bg-foreground/10 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  {isSubmitting ? (
                    <div className="h-3 w-3 sm:h-3.5 sm:w-3.5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowUpRight
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-foreground"
                      strokeWidth={2.5}
                    />
                  )}
                </div>
              </button>
            </form>
          </div>

          {/* Right side (Info Accordions) */}
          <div className={`w-full xl:w-[320px] flex flex-col gap-5 ${styles.accordionsCol}`}>
            {contactData.map((item, idx) => (
              <ContactAccordion
                key={item.index}
                data={item}
                className={`${styles.contactCard} ${styles[`contactCard${idx + 1}`]}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
