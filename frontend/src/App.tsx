import Calculator from './components/Calculator'

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="./" aria-label="Calculator home"><span className="brand-icon" aria-hidden="true">c</span>alculator<span className="wordmark-dot">.</span></a>
      </header>
      <main>
        <Calculator />
      </main>
      <footer className="site-footer"><span>By: Isaac Gomez Ocon.</span></footer>
    </div>
  )
}
