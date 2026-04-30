const eventsData = [
  {
    id: 1,
    dayName: 'Mon',
    day: '26',
    month: 'Jan',
    image: 'https://smvec.ac.in/wp-content/uploads/2026/02/image-3-1024x682.jpeg',
    location: 'MVIT Campus',
    title: 'Republic Day Celebration 2026',
    desc: 'MVIT celebrated the 77th Republic Day with great pride on 26th January 2026.',
    tag: 'Reunion',
  },
  {
    id: 2,
    dayName: 'Mon',
    day: '12',
    month: 'Jan',
    image: 'https://smvec.ac.in/wp-content/uploads/2026/01/image.jpeg',
    location: 'MVIT Campus',
    title: 'Pongal Thiruvizha 2026',
    desc: 'Pongal Thiruvizha 2026 was celebrated with great enthusiasm and cultural spirit at Manakula Vinayagar Institute of Technology (MVIT). ',
    tag: 'Celebration',
  },
  {
    id: 3,
    dayName: 'mon',
    day: '05',
    month: 'Jan',
    image: 'https://smvec.ac.in/wp-content/uploads/2025/12/image-43-1024x683.jpeg',
    location: 'Main Auditorium',
    title: 'Reach the unreach – Indian space programme',
    desc: 'An insightful technical talk titled “Reach the Unreached – Indian Space Programme” was successfully organized to create awareness about India’s remarkable journey in space science and its applications for national development.',
    tag: 'Ceremony',
  },
]

function EventsHighlight() {
  return (
    <section className="events-highlight-section section">
      <div className="container">
        <div className="events-highlight-header">
          <p className="events-eyebrow">What&apos;s On</p>
          <h2>Upcoming Events</h2>
          <p className="events-sub">Don&apos;t miss out on exciting alumni events</p>
        </div>

        <div className="events-cards-grid">
          {eventsData.map((event) => (
            <div
              className="event-img-card"
              key={event.id}
              style={{ backgroundImage: `url(${event.image})` }}
            >
              {/* Dark overlay */}
              <div className="event-img-overlay" />

              {/* Top row */}
              <div className="event-img-top">
                <div className="event-date-badge">
                  <span className="edb-day-name">{event.dayName}</span>
                  <span className="edb-day">{event.day}</span>
                  <span className="edb-month">{event.month}</span>
                </div>

                <div className="event-info-btn" aria-label="Event info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="8" strokeLinecap="round" strokeWidth="2.5" />
                    <line x1="12" y1="12" x2="12" y2="16" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                  <div className="event-tooltip">{event.desc}</div>
                </div>
              </div>

              {/* Bottom info */}
              <div className="event-img-bottom">
                <span className="event-location-tag">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  {event.location}
                </span>
                <h3 className="event-img-title">{event.title}</h3>
                <a
                  href="https://smvec.ac.in/events"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-register-btn"
                >
                  View More
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="events-view-all">
          <a
            href="https://smvec.ac.in/events"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            View All Events
          </a>
        </div>
      </div>
    </section>
  )
}

export default EventsHighlight
