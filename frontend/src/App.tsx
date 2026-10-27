import Calculator from './components/Calculator'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="./" aria-label="Calculator home"><span className={styles.brandIcon} aria-hidden="true">c</span>alculator<span className={styles.dot}>.</span></a>
      </header>
      <main>
        <Calculator />
      </main>
      <footer className={styles.footer}><span>By: Isaac Gomez Ocon.</span></footer>
    </div>
  )
}
