import Header from './components/Header'
import IdleState from './components/IdleState'

// Side panel shell: single vertical column — header (status + controls), then
// the body. Result sections (concept → explanation → code → parameters) replace
// the idle state once analysis exists (Next Up #6). Status is hardcoded to
// 'idle' until the messaging contract lands (Next Up #4).
export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-base font-sans text-primary">
      <Header status="idle" />
      <main className="flex flex-1 flex-col">
        <IdleState />
      </main>
    </div>
  )
}
