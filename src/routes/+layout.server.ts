
export async function load({ locals }: {
  locals: App.Locals;
}) {
  return {
    benutzer: locals.benutzer
  };
}
