import Hero from './components/Hero'
import AlumniCell from './components/AlumniCell'
import FounderQuote from './components/FounderQuote'
import NotableAlumni from './components/NotableAlumni'
import EventsHighlight from './components/EventsHighlight'
import CtaSection from './components/CtaSection'
import Preloader from '../../components/Preloader'

function Home() {
  return (
    <div className="home-main page-content">
      <Preloader/>
      <Hero />
      <AlumniCell />
      <FounderQuote />
      <NotableAlumni />
      <EventsHighlight />
      <CtaSection />
    </div>
  )
}

export default Home
