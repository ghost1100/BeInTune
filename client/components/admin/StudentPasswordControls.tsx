export default function StudentPasswordControls() {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "StudentPasswordControls component has been deprecated. Use StudentsManager in Admin.tsx instead.",
    );
  }
  return null;
}
