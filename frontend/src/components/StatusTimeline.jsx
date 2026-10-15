import { ORDER_STEPS, STATUS_LABELS, formatDateTime } from '../utils/format.js';

/** PLACED → CONFIRMED → SHIPPED → DELIVERED progress for a paid order. */
export default function StatusTimeline({ order }) {
  const currentIndex = ORDER_STEPS.indexOf(order.status);
  const reachedAt = Object.fromEntries((order.statusHistory || []).map((event) => [event.status, event.at]));

  return (
    <ol className="timeline" aria-label="Order progress">
      {ORDER_STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li key={step} className={`timeline__step timeline__step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="timeline__dot" aria-hidden="true">
              {state === 'todo' ? index + 1 : '✓'}
            </span>
            <span className="timeline__label">{STATUS_LABELS[step]}</span>
            {reachedAt[step] && index <= currentIndex && (
              <span className="timeline__time">{formatDateTime(reachedAt[step])}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
