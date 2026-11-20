'use strict';
/* ============================================================
   Auto Car — البيانات المرجعية: الماركات، الطرازات، الفئات، الألوان
   ============================================================ */
const { registerMaster } = require('../lib/crud');

module.exports = function catalogRoutes(app) {
  registerMaster(app, {
    base: 'brands', table: 'brands', perm: 'catalog.manage', label: 'الماركة',
    searchCols: ['name', 'name_en', 'country'], order: 'name',
    fields: ['name', 'name_en', 'logo', 'country', 'active'],
  });

  registerMaster(app, {
    base: 'car-types', table: 'car_types', perm: 'catalog.manage', label: 'الفئة',
    searchCols: ['name', 'name_en'], order: 'name',
    fields: ['name', 'name_en', 'active'],
  });

  registerMaster(app, {
    base: 'car-models', table: 'car_models', perm: 'catalog.manage', label: 'الطراز',
    searchCols: ['name', 'name_en'], order: 'name',
    select: `SELECT t.*, b.name AS brand_name FROM car_models t LEFT JOIN brands b ON b.id = t.brand_id`,
    fields: ['brand_id', 'name', 'name_en', 'type_id', 'active'],
  });

  registerMaster(app, {
    base: 'colors', table: 'colors', perm: 'catalog.manage', label: 'اللون',
    searchCols: ['name', 'name_en'], order: 'name',
    fields: ['name', 'name_en', 'hex', 'active'],
  });
};
