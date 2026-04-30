import { useState } from 'react'
import { HiMail, HiPhone, HiLocationMarker, HiClock } from 'react-icons/hi'

function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Thank you for your message! We will get back to you soon.')
    setForm({ name: '', email: '', subject: '', message: '' })
  }

  return (
    <div className="contact-page page-content">
      <section className="contact-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p>We would love to hear from you</p>
        </div>
      </section>

      <section className="contact-content">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-form-wrapper">
              <h2>Send us a Message</h2>

              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="What is this regarding?"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Write your message here..."
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary">Send Message</button>
              </form>
            </div>

            <div className="contact-info">
              <h2>Get in Touch</h2>
              <p>Reach out to us through any of these channels.</p>

              <div className="info-cards">
                <div className="info-card card">
                  <div className="info-icon"><HiLocationMarker /></div>
                  <div className="info-text">
                    <h4>Address</h4>
                    <p>Manakula Vinayagar Institute of Technology, Madagadipet, Puducherry - 605107</p>
                  </div>
                </div>

                <div className="info-card card">
                  <div className="info-icon"><HiPhone /></div>
                  <div className="info-text">
                    <h4>Phone</h4>
                    <p>+91 413 2516 789</p>
                  </div>
                </div>

                <div className="info-card card">
                  <div className="info-icon"><HiMail /></div>
                  <div className="info-text">
                    <h4>Email</h4>
                    <p>alumni@smvec.ac.in</p>
                  </div>
                </div>

                <div className="info-card card">
                  <div className="info-icon"><HiClock /></div>
                  <div className="info-text">
                    <h4>Office Hours</h4>
                    <p>Mon - Fri: 9:00 AM - 5:00 PM<br />Sat: 9:00 AM - 1:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
