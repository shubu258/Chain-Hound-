import { SiteNav } from "@/components/SiteNav";
import { InvestigationView } from "@/components/InvestigationView";
import { PipelineSection } from "@/components/PipelineSection";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteNav />
      <InvestigationView />
      <PipelineSection />
      <SiteFooter />
    </>
  );
}
