import { OsEventTypeList } from "@evenrealities/even_hub_sdk";

export type G2LifecycleStep = "exit" | "leave" | "enter";
/**
 * The session follows the G2 page, not phone page visibility: a locked phone or a backgrounded Even app keeps
 * listening, recording and polling. Only the host's own events pause, resume or end it. FOREGROUND_EXIT/ENTER are
 * read as the G2 page leaving and returning to the glasses foreground: they belong to the host's PB-aligned glasses
 * event enum, arrive on the same channel as G2 gestures, and the SDK bundle derives no event from browser
 * visibility. Neither the SDK nor the official docs define them, so whether the host ever sends them on a phone lock
 * is unresolved; the phone status names every pause and resume so a device run can tell.
 */
export function g2LifecycleStep(type: OsEventTypeList | undefined): G2LifecycleStep | undefined {
  if (type === OsEventTypeList.SYSTEM_EXIT_EVENT || type === OsEventTypeList.ABNORMAL_EXIT_EVENT) return "exit";
  if (type === OsEventTypeList.FOREGROUND_EXIT_EVENT) return "leave";
  if (type === OsEventTypeList.FOREGROUND_ENTER_EVENT) return "enter";
  return undefined;
}
/** Glasses input, which the host delivers only to the foreground G2 page; audio and IMU frames are not input. */
export function gesture(type: OsEventTypeList | undefined): boolean {
  return (
    type === OsEventTypeList.LONG_PRESS_EVENT ||
    type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT ||
    type === OsEventTypeList.SCROLL_TOP_EVENT ||
    type === OsEventTypeList.SCROLL_BOTTOM_EVENT
  );
}
