import { addDays, dateLabel, SCHEDULE_DAYS } from "./hours-schedule.js";
import { esc } from "./customer-ui.js";

export function scheduledHoursList(schedule, today, formatClock, manager = false) {
  // Customers already see today's effective hours, including any quick override.
  const entries = Object.entries(schedule).filter(([date]) => manager ? date >= today : date > today).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return manager ? '<p class="device-note">No upcoming exceptions. Regular hours apply.</p>' : "";
  return `<h3 class="hours-visit-label">Dated hours</h3><ul class="scheduled-hours-list">${entries.map(([date, value]) => `<li><span><strong>${esc(dateLabel(date))}</strong><br/>${value.closed ? "Closed" : `${esc(formatClock(value.open))}–${esc(formatClock(value.close))}`}</span>${manager ? `<button type="button" class="text-button" data-act="schedule-edit" data-date="${date}" aria-label="Edit hours for ${esc(dateLabel(date))}">Edit</button>` : ""}</li>`).join("")}</ul>`;
}

export function scheduleSheet(schedule, draft, today, busy, message, controls, formatClock) {
  return `<button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet"></button>
    <aside class="sheet schedule-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Plan special hours">${controls}
      <div class="sheet-kicker">Shop hours</div><h2 class="sheet-title">Plan special hours</h2>
      <p class="device-note">Schedule a closure or special opening for a date. All dates and times use America/Chicago. Other days keep regular hours. Today’s quick controls take priority; saving today here replaces that override. Removing an exception restores regular hours.</p>
      <form class="form" data-act="schedule-form">
        <label class="field-label">Date<input class="field" type="date" data-act="schedule-date" value="${esc(draft.date)}" min="${today}" max="${addDays(today, SCHEDULE_DAYS)}" required/></label>
        <label class="check-row"><input type="checkbox" data-act="schedule-closed" ${draft.closed ? "checked" : ""}/>Closed all day</label>
        <div class="schedule-times"><label class="field-label">Opening time<input class="field" type="time" data-act="schedule-open" value="${esc(draft.open)}" ${draft.closed ? "disabled" : "required"}/></label><label class="field-label">Closing time<input class="field" type="time" data-act="schedule-close" value="${esc(draft.close)}" ${draft.closed ? "disabled" : "required"}/></label></div>
        ${message ? `<p class="staff-message" role="status">${esc(message)}</p>` : ""}
        <button class="primary-btn" type="submit" ${busy ? "disabled" : ""}>${busy ? "Saving…" : "Save dated hours"}</button>
        ${draft.original ? `<button class="text-button" type="button" data-act="schedule-remove" ${busy ? "disabled" : ""}>Remove this exception</button>` : ""}
      </form>
      ${scheduledHoursList(schedule, today, formatClock, true)}
    </aside>`;
}
