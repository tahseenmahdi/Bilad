'use client';

import { useCategoryHash } from '@/lib/use-category-hash';
import TravelShortcuts from './TravelShortcuts';
import TaxiIcon from './TaxiIcon';
import { AtmosphereLink } from './AtmosphereTransition';
import ServiceLogos from './ServiceLogos';
import BackToTower from './BackToTower';
import { serviceApps, serviceAsset, serviceCategories, type ServiceCategory } from '@/lib/services';
import './services.css';

function CategoryIcon({ category }: { category: ServiceCategory }) {
  if (category === 'taxi') return <TaxiIcon />;
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {category === 'order' ? <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>
          : <><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="20" r=".7" fill="currentColor" /></>}
    </svg>
  );
}

export default function ServicesBrowser() {
  const [category, setCategory] = useCategoryHash(serviceCategories, 'taxi');

  return (
    <main className="ai-page services-page">
      <header className="ai-header">
        <AtmosphereLink href="/" className="ai-brand"><span aria-label="Bilad">BI<span className="inverted">L</span>AD</span></AtmosphereLink>
        <BackToTower href="/#services" />
      </header>
      <div className="ai-page-particles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="ai-ghost-tower" aria-hidden="true" />
      <section className="ai-core services-core" aria-label="Daleel service apps">
        <ServiceLogos />
        <h1>You want a taxi?<br />Order or get internet.</h1>
        <p className="services-subtitle">Then use Daleel.</p>
        <div className="discovery-stage services-stage category-is-open">
          <nav className="discovery-choices services-choices" aria-label="Service categories">
            {serviceCategories.map(item => (
              <button key={item.id} type="button" className="ai-composer ai-launch discovery-launch service-category" aria-pressed={category === item.id} aria-controls="service-results" onClick={() => setCategory(item.id)}>
                <CategoryIcon category={item.id} /><span className="launch-label">{item.label}</span><span className="launch-trace" aria-hidden="true" />
              </button>
            ))}
          </nav>
            <div key={category} id="service-results" className="services-results" role="region" aria-labelledby="service-category-heading">
              <div className="services-results-heading">
                <CategoryIcon category={category} />
                <h2 id="service-category-heading">{serviceCategories.find(item => item.id === category)?.label}</h2>
              </div>
              <ul className="service-apps">
                {serviceApps.filter(app => app.categories.includes(category)).map((app, index) => (
                  <li key={app.id} className="service-app" style={{ animationDelay: `${.18 + index * .055}s` }}>
                    <img src={serviceAsset(app.id)} alt="" width="48" height="48" />
                    <div className="service-app-copy"><h3>{app.name}</h3><p>{app.brief}</p>
                      <a href={app.href} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${app.name} (opens in a new tab)`}>Visit app <span aria-hidden="true">↗</span></a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
        </div>
        <TravelShortcuts context="services" />
      </section>
    </main>
  );
}
