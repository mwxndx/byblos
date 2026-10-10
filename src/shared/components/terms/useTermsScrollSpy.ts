import { useEffect, useState, useCallback } from 'react';

export const TERMS_SECTIONS = [
  { id: 'privacy', label: '1. Privacy Policy' },
  { id: 'agreement', label: '2. Client Agreement' },
  { id: 'refund', label: '3. Refund Policy' },
  { id: 'risk', label: '4. Risk Disclosure' },
  { id: 'ip', label: '5. Intellectual Property' },
  { id: 'prohibited', label: '6. Prohibited Conduct' },
  { id: 'liability', label: '7. Limitation of Liability' },
  { id: 'disputes', label: '8. Dispute Resolution' },
  { id: 'amendments', label: '9. Amendments' },
  { id: 'governing', label: '10. Governing Law' },
];

export function useTermsScrollSpy(isOpen: boolean, initialSection: string) {
  const [activeSection, setActiveSection] = useState(initialSection);

  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (isOpen) setActiveSection(initialSection);
  }, [isOpen, initialSection]);

  const scrollToInitialSection = useCallback(() => {
    const el = document.getElementById(`section-${initialSection}`);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [initialSection]);

  const handleContentScroll = useCallback((container: HTMLElement) => {
    for (const s of TERMS_SECTIONS) {
      const el = document.getElementById(`section-${s.id}`);
      if (el && el.offsetTop - container.scrollTop < 200) {
        setActiveSection(s.id);
      }
    }
  }, []);

  return {
    activeSection,
    scrollTo,
    scrollToInitialSection,
    handleContentScroll,
    sections: TERMS_SECTIONS,
  };
}
