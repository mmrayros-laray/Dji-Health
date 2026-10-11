import { Redirect } from "expo-router";

/** Unknown paths (e.g. the address a preview host serves the page from) go to the home screen. */
export default function NotFound() {
  return <Redirect href="/" />;
}
