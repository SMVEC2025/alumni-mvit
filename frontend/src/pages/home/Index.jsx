import Hero from './components/Hero'
import AlumniCell from './components/AlumniCell'
import FounderQuote from './components/FounderQuote'
import EventsHighlight from './components/EventsHighlight'
import CtaSection from './components/CtaSection'

function Home() {
  return (
    <div className="home-main page-content">
      <Hero />
      <AlumniCell />
      <FounderQuote />
      {/* <NotableAlumni /> */}
      <EventsHighlight />
      <CtaSection />
    </div>
  )
}

export default Home
