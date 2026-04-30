import { HiBell, HiInformationCircle } from 'react-icons/hi'

const notifications = [
  {
    id: 1,
    title: 'Annual Alumni Meet 2026 — Registration Open',
    body: 'Join us on 15 March 2026 for a grand reunion at MVIT Campus. Register your spot before 10 March to confirm attendance.',
    time: '2 hours ago',
  },

]

function Events() {
  return (
    <div className="notifications-page page-content">

      <section className="notifications-hero">
        <div className="container">
          <div className="notifications-hero-inner">
            <HiBell className="notifications-hero-icon" />
            <div>
              <h1>Notification Centre</h1>
              <p>Stay up to date with events, announcements, and updates from MVIT Alumni</p>
            </div>
          </div>
        </div>
      </section>

      <section className="notifications-content">
        <div className="container">
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <HiInformationCircle />
              <p>No notifications yet.</p>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((notif) => (
                <div key={notif.id} className="notif-card">
                  <div className="notif-icon-wrap">
                    <HiBell />
                  </div>
                  <div className="notif-body">
                    <span className="notif-time">{notif.time}</span>
                    <h3 className="notif-title">{notif.title}</h3>
                    <p className="notif-text">{notif.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  )
}

export default Events
