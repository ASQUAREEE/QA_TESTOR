import { Card, CardContent } from "~/components/ui/card"

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Social Media Manager",
    content: "This AI copilot has revolutionized how I manage multiple accounts. It's like having a team of experts at my fingertips!",
  },
  {
    name: "Mike Chen",
    role: "Small Business Owner",
    content: "I was skeptical at first, but this tool has saved me hours each week. My engagement rates have never been better!",
  },
  {
    name: "Emily Rodriguez",
    role: "Influencer",
    content: "The content suggestions are spot-on, and the automated scheduling is a game-changer. Highly recommended!",
  },
]

export default function Testimonials() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-semibold mb-8 text-center">What Our Users Say</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <p className="mb-4">{testimonial.content}</p>
              <div className="font-semibold">{testimonial.name}</div>
              <div className="text-sm text-gray-600">{testimonial.role}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}