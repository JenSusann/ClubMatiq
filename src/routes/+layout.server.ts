
export async function load({ locals }: {
  locals: App.Locals;
}) {
  return {
    demo: process.env.MONGODB_DB_NAME === 'clubmatiq_demo',
    benutzer: locals.benutzer,
    sessionFristen: locals.sessionFristen
  };
}
