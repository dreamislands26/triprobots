// Initial triage; qualified means review by Maria, never automatic outreach.
const exclusions = /массов(ый|ого|ку)|официант|водител|оператор|врач|акт[её]р|салон.{0,12}красоты|обслуживающ|horeca|хорек/iu;
const roles = /менеджер.{0,12}продаж|руководител|директор|главн.{0,5}инженер|техническ.{0,8}специалист|аналитик|юрист|бухгалтер|рекрутер|(^|[^a-z])hr(d)?([^a-z]|$)|топ-менеджер/iu;
const intent = /ищем.{0,30}(кадров.{0,10}агентств|рекрутингов.{0,10}агентств)|порекомендуйте.{0,30}агентств|готовы.{0,15}отдать.{0,35}подбор|не можем.{0,12}закрыть.{0,30}(сами|самостоятельно)/iu;
const hiring = /ищем|нанимаем|ваканси|требуется/iu;
const seeker = /ищу работу|в поиске работы|рассмотрю вакансии|мо[её] резюме/iu;
export function screen({text='', role='', region='', budget=null}) {
  if (!text.trim() || seeker.test(text)) return 'exclude';
  if (exclusions.test(role || text) || (Number.isFinite(budget) && budget < 100000)) return 'exclude';
  if (!roles.test(role || text)) return intent.test(text) ? 'review_role' : 'exclude';
  if (intent.test(text)) return region && !/москв|московск/iu.test(region) ? 'direct_regional' : 'direct';
  return hiring.test(text) ? 'vacancy' : 'exclude';
}
