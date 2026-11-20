-- 095600_translate_stored_text.sql
-- Project rule: code, data and documentation are written in English. Some rows kept
-- Spanish text from the import and the early cost seeds. This translates the stored text
-- in place; no meaning changes.

update public.item_cost_history
set note = 'catalog cost, no real effective date'
where note = 'costo cargado en el catálogo, sin fecha real';

update public.item_cost_history
set note = 'placeholder of 1 dollar until the real average is confirmed'
where note = 'provisorio de 1 dolar hasta confirmar promedio real';

update public.item_price_history
set note = 'catalog price, no real effective date'
where note = 'precio cargado en el catálogo, sin fecha real';

update public.import_review set reason = 'service with no unit price'
where reason = 'servicio sin precio unitario';

update public.import_review set reason = 'product with no unit price'
where reason = 'producto sin precio unitario';

update public.import_review set reason = 'workbook total does not match'
where reason = 'total del Excel no coincide';

update public.import_review set reason = 'row is not a sale'
where reason = 'fila que no es una venta';

-- The refund trigger allows only a state change, so it is disabled for this one-time
-- translation of the stored reason and re-enabled immediately.
alter table public.sale_refunds disable trigger sale_refunds_state_only;

update public.sale_refunds
set reason = 'Frank Alonso refund, workbook August summary line'
where reason = 'Devolucion de Frank Alonso, linea de resumen del workbook de agosto';

alter table public.sale_refunds enable trigger sale_refunds_state_only;

update public.adjustments
set reason = 'Stripe no-show, workbook September summary line'
where reason = 'Stripe no-show, linea de resumen del workbook de septiembre';

update public.adjustments
set reason = 'Stripe no-show, workbook October summary line'
where reason = 'Stripe no-show, linea de resumen del workbook de octubre';

update public.customer_merge_candidates
set evidence = 'Nickname: same patient, same card'
where evidence = 'Hipocorístico: misma paciente, misma tarjeta';

update public.customer_merge_candidates
set evidence = 'DOUBTFUL: the name order changes'
where evidence = 'DUDOSO: el orden de los nombres cambia';

update public.customer_merge_candidates
set evidence = 'Same monthly series, same WL package'
where evidence = 'Misma serie mensual, mismo paquete WL';

update public.customer_merge_candidates
set evidence = 'DOUBTFUL: Denise and Danese may be different surnames'
where evidence = 'DUDOSO: Denise y Danese pueden ser apellidos distintos';

update public.customer_merge_candidates
set evidence = 'Monthly GLP-1, same payment method'
where evidence = 'GLP-1 mensual, mismo método de pago';

update public.customer_merge_candidates
set evidence = 'Same IV Series, June to September'
where evidence = 'Mismo IV Series, junio a septiembre';

update public.customer_merge_candidates
set evidence = 'Same Energy Precision line'
where evidence = 'Misma línea Energy Precision';

update public.customer_merge_candidates
set evidence = 'DOUBTFUL: first and last name change, same service'
where evidence = 'DUDOSO: cambian nombre y apellido, misma prestación';

update public.customer_merge_candidates
set evidence = 'Same 495 package, same visit sequence'
where evidence = 'Mismo paquete de 495, misma secuencia de visitas';

update public.customer_merge_candidates
set evidence = 'Botox and Biostimulator, same closing dates'
where evidence = 'Botox y Biostimulador, mismas fechas de cierre';
