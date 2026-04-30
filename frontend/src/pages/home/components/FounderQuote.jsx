function FounderQuote() {
  return (
    <section className="founder-quote-section">
      <div className="founder-quote-inner">

        {/* ── Left: Quote ── */}
        <div className="founder-quote-left">
          <span className="founder-quote-ornament">&ldquo;</span>
          <blockquote className="founder-quote-text">
            We started in 1999, in a small shed with just 180 students &amp; 4 courses
          </blockquote>
          <div className="founder-quote-divider" />
          <div className="founder-quote-attr">
            <p className="founder-name">M. Dhanasekaran</p>
            <p className="founder-title">Founder, Chairman &amp; Managing Director</p>
          </div>
        </div>

        {/* ── Right: Image ── */}
        <div className="founder-quote-right">
          <div className="founder-img-frame">
            <img
              src="/img/chairr_man.webp"
              alt="M. Dhanasekaran — Founder, Chairman & Managing Director"
            />
          </div>
        </div>

      </div>
    </section>
  )
}

export default FounderQuote
