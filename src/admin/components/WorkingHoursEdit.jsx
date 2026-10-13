import React, { useState, useEffect } from "react";
import {
  Box,
  CheckBox,
  Label,
  Input,
  FormGroup,
  Text,
} from "@adminjs/design-system";

const DAYS = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];

function parseValue(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Existing records come back from AdminJS with the workingHours Json
// field flattened into dot-notation (workingHours.fri.0, workingHours.mon.0,
// ...) rather than a single JSON string under the bare key — same pattern
// as the Staff.services relation. This reconstructs the nested object
// from either shape: a literal string/object under the bare key (which is
// what our own onChange writes during an editing session), or the
// flattened per-day keys AdminJS hands back for a freshly loaded record.
function readWorkingHours(record, propertyName) {
  const params = record?.params || {};

  if (params[propertyName]) {
    return parseValue(params[propertyName]);
  }

  const prefix = `${propertyName}.`;
  const result = {};
  Object.keys(params)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => {
      const rest = key.slice(prefix.length); // e.g. "fri.0"
      const [day, idxStr] = rest.split(".");
      if (!day) return;
      if (!result[day]) result[day] = [];
      const idx = Number(idxStr);
      if (!Number.isNaN(idx)) {
        result[day][idx] = params[key];
      } else {
        result[day].push(params[key]);
      }
    });
  return result;
}

function rangeToTimes(range) {
  if (!range) return { start: "09:00", end: "17:00" };
  const [start, end] = range.split("-");
  return { start: start || "09:00", end: end || "17:00" };
}

const WorkingHoursEdit = (props) => {
  const { property, record, onChange } = props;
  const initial = readWorkingHours(record, property.name);

  const [schedule, setSchedule] = useState(() =>
    DAYS.reduce((acc, day) => {
      const existing = initial[day.key]?.[0];
      const times = rangeToTimes(existing);
      acc[day.key] = {
        enabled: Boolean(existing),
        start: times.start,
        end: times.end,
      };
      return acc;
    }, {}),
  );

  useEffect(() => {
    const workingHours = {};
    DAYS.forEach((day) => {
      const d = schedule[day.key];
      if (d.enabled) workingHours[day.key] = [`${d.start}-${d.end}`];
    });
    onChange(property.name, JSON.stringify(workingHours));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  function updateDay(dayKey, field, value) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  }

  return (
    <FormGroup>
      <Label>{property.label}</Label>
      <Box>
        {DAYS.map((day) => (
          <Box
            key={day.key}
            display="flex"
            alignItems="center"
            gap="12px"
            mb="8px"
          >
            <Box width="150px" display="flex" alignItems="center">
              <CheckBox
                id={`wh-${day.key}`}
                checked={schedule[day.key].enabled}
                onChange={() =>
                  updateDay(day.key, "enabled", !schedule[day.key].enabled)
                }
              />
              <Label htmlFor={`wh-${day.key}`} inline ml="8px">
                {day.label}
              </Label>
            </Box>
            <Input
              type="time"
              value={schedule[day.key].start}
              disabled={!schedule[day.key].enabled}
              onChange={(e) => updateDay(day.key, "start", e.target.value)}
              width="120px"
            />
            <Text>to</Text>
            <Input
              type="time"
              value={schedule[day.key].end}
              disabled={!schedule[day.key].enabled}
              onChange={(e) => updateDay(day.key, "end", e.target.value)}
              width="120px"
            />
          </Box>
        ))}
      </Box>
    </FormGroup>
  );
};

export default WorkingHoursEdit;
