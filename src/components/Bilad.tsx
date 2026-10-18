export default function Bilad() {
  return (
    <main className="opening">
      <div className="atmosphere" aria-hidden="true" />
      <h1 className="wordmark" aria-label="Bilad" dir="ltr">
        <span>B</span><span>I</span><span className="inverted">L</span><span>A</span><span>D</span>
      </h1>
      <div className="tower-wrap">
        <img className="tower" src="/assets/malwiya.png" alt="Malwiya Minaret of Samarra" fetchPriority="high" draggable="false" />
      </div>
    </main>
  );
}
