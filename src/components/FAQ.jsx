import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"

const faqItems = [
  {
    question: "What is AI Copilot?",
    answer: "AI Copilot is an advanced social media management tool that uses artificial intelligence to help you optimize your social media presence, automate posting, analyze engagement, and create content effortlessly."
  },
  {
    question: "How does AI Copilot work?",
    answer: "AI Copilot analyzes your social media accounts, audience behavior, and content performance. It then provides recommendations for optimal posting times, generates content ideas, and automates repetitive tasks to improve your social media strategy."
  },
  {
    question: "Is AI Copilot compatible with all social media platforms?",
    answer: "AI Copilot supports major social media platforms including Facebook, Twitter, Instagram, LinkedIn, and TikTok. We're constantly working on expanding our platform support."
  },
  {
    question: "Can I try AI Copilot before purchasing?",
    answer: "Yes! We offer a 14-day free trial that gives you full access to all AI Copilot features. No credit card is required to start your trial."
  }
]

export default function FAQ() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <h2 className="text-3xl font-semibold mb-8 text-center">Frequently Asked Questions</h2>
      <Accordion type="single" collapsible className="max-w-2xl mx-auto">
        {faqItems.map((item, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}