// Look of each stage; the numbers come from GET /dashboard/pipeline.
// Stage colors are a fixed, colorblind-validated order; keep color tied to the stage, not its position
export const STAGES = [
  {
    id: 'intake',
    step: '01',
    short: 'Intake',
    label: 'Received',
    color: '#2a78d6',
  },
  {
    id: 'wash',
    step: '02',
    short: 'Wash',
    label: 'Washing',
    color: '#eb6834',
  },
  {
    id: 'dry',
    step: '03',
    short: 'Dry',
    label: 'Drying',
    color: '#1baf7a',
  },
  {
    id: 'press',
    step: '04',
    short: 'Press',
    label: 'Ironing & Press',
    color: '#eda100',
  },
  {
    id: 'qa',
    step: '05',
    short: 'QA Check',
    label: 'Quality Check',
    color: '#6250d6',
  },
  {
    id: 'ready',
    step: '06',
    short: 'Ready',
    label: 'Ready for Pickup',
    color: '#008300',
  },
  {
    id: 'route',
    step: '07',
    short: 'Route',
    label: 'Out for Delivery',
    color: '#e87ba4',
  },
] as const

export type StageId = (typeof STAGES)[number]['id']

export function getStage(id: StageId) {
  return STAGES.find((stage) => stage.id === id)!
}
