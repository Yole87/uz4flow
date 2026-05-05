import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

export interface TutorialStep {
  title: string;
  description: string;
}

interface ServiceTutorialStepsProps {
  steps: TutorialStep[];
}

export function ServiceTutorialSteps({ steps }: ServiceTutorialStepsProps) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <Accordion type="single" collapsible className="w-full">
          {steps.map((step, index) => (
            <AccordionItem key={index} value={`step-${index}`} className="border-border">
              <AccordionTrigger className="hover:no-underline py-3 gap-3">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/20 text-accent text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">{step.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-10 text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
