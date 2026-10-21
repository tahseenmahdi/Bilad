import { serviceApps, serviceAsset } from '@/lib/services';

export default function ServiceLogos() {
  return (
    <div className="service-logos" aria-hidden="true">
      {serviceApps.map(app => (
        <span key={app.id} className="service-logo">
          <img src={serviceAsset(app.id)} alt="" width="54" height="54" draggable="false" />
        </span>
      ))}
    </div>
  );
}
