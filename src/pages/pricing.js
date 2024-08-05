import Head from 'next/head'
import Header from '~/components/Header'
import Footer from '~/components/Footer'
import { Button } from "~/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import { useState } from 'react'

const pricingPlans = [
  {
    name: "Basic",
    price: "$9.99",
    features: [
      "1 social media account",
      "10 AI-generated posts per month",
      "Basic analytics",
      "Email support"
    ]
  },
  {
    name: "Pro",
    price: "$29.99",
    features: [
      "5 social media accounts",
      "50 AI-generated posts per month",
      "Advanced analytics",
      "Priority email support",
      "Content calendar"
    ]
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: [
      "Unlimited social media accounts",
      "Unlimited AI-generated posts",
      "Custom analytics dashboard",
      "24/7 phone support",
      "Dedicated account manager",
      "API access"
    ]
  }
]

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState(null)

  return (
    <>
      <Head>
        <title>Pricing - AI Copilot</title>
        <meta name="description" content="Choose the perfect plan for your social media management needs." />
      </Head>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-8 text-center">Choose Your Plan</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`flex flex-col transition-all duration-300 ${selectedPlan === index ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
                // @ts-ignore
                onClick={() => setSelectedPlan(index)}
              >
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-3xl font-bold mb-4">{plan.price}</p>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-6 mt-auto">
                  <Button className="w-full">{plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}</Button>
                </div>
              </Card>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}