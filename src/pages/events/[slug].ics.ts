import type { APIRoute, GetStaticPaths } from 'astro';
import { getEvents, type HouseEvent } from '../../lib/events';
import { ics } from '../../lib/calendar';

export const getStaticPaths: GetStaticPaths = async () => {
  const events = await getEvents('it');
  return events.map((event) => ({ params: { slug: event.slug }, props: { event } }));
};

export const GET: APIRoute = ({ props }) =>
  new Response(ics((props as { event: HouseEvent }).event), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
