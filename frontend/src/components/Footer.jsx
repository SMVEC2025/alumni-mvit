import { Link } from 'react-router-dom'
import { HiMail, HiPhone, HiLocationMarker } from 'react-icons/hi'
import { FaFacebook, FaInstagram, FaWhatsapp, FaYoutube } from 'react-icons/fa'

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <img src="/img/logo/dark.svg" alt="MVIT Alumni" className="footer-logo-img" />
            <p>
              Connecting graduates across the globe. Stay in touch with your alma mater
              and fellow alumni through our vibrant network.
            </p>
            <div className="footer-social">
              <a href="https://www.facebook.com/SMVECOfficial" target="_blank" rel="noreferrer" aria-label="SMVEC Facebook"><FaFacebook /></a>
              <a href="https://www.youtube.com/@official_smvec" target="_blank" rel="noreferrer" aria-label="SMVEC YouTube"><FaYoutube /></a>
              <a href="https://api.whatsapp.com/send/?phone=916385155814&text&app_absent=0" target="_blank" rel="noreferrer" aria-label="SMVEC WhatsApp"><FaWhatsapp /></a>
              <a href="https://www.instagram.com/smvec_official" target="_blank" rel="noreferrer" aria-label="SMVEC Instagram"><FaInstagram /></a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/directory">Directory</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Alumni</h4>
            <ul>
              <li><Link to="/register">Register</Link></li>
              <li><Link to="/login">Login</Link></li>
              <li><Link to="/directory">Find Alumni</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <div className="footer-contact-item">
              <HiLocationMarker />
              <span>MVIT, Puducherry, India</span>
            </div>
            <div className="footer-contact-item">
              <HiPhone />
              <span>+91 413 2516 789</span>
            </div>
            <div className="footer-contact-item">
              <HiMail />
              <span>alumni@smvec.ac.in</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} MVIT Alumni Association. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

export default Footer
