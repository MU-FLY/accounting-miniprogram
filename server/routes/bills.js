const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all bills
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, year, month, type, pageSize } = req.query;
    let sql = 'SELECT * FROM bills WHERE 1=1';
    const params = [];

    // 优先使用 startDate/endDate（YYYY-MM-DD 字符串格式）
    if (startDate && endDate) {
      sql += ' AND date >= ? AND date <= ?';
      params.push(startDate, endDate);
    } else if (year) {
      sql += ' AND YEAR(date) = ?';
      params.push(year);
      if (month) {
        sql += ' AND MONTH(date) = ?';
        params.push(month);
      }
    }

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    if (pageSize) {
      sql += ' LIMIT ?';
      params.push(Number(pageSize));
    }

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, bills: rows });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create bill
router.post('/', async (req, res) => {
  try {
    const { type, category, amount, date, remark } = req.body;
    
    // date 直接是 YYYY-MM-DD 字符串，无需转换
    const [result] = await pool.execute(
      'INSERT INTO bills (type, category, amount, date, note) VALUES (?, ?, ?, ?, ?)',
      [type, category, amount, date, remark || '']
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete bill (DELETE method)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM bills WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete bill (POST method for compatibility)
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await pool.execute('DELETE FROM bills WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get summary
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate, year, month } = req.query;
    let sql = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
        COUNT(*) as totalCount
      FROM bills
      WHERE 1=1
    `;
    const params = [];

    // 优先使用 startDate/endDate（YYYY-MM-DD 字符串格式）
    if (startDate && endDate) {
      sql += ' AND date >= ? AND date <= ?';
      params.push(startDate, endDate);
    } else if (year) {
      sql += ' AND YEAR(date) = ?';
      params.push(year);
      if (month) {
        sql += ' AND MONTH(date) = ?';
        params.push(month);
      }
    }

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { year, month } = req.query;

    // Monthly summary
    let monthlySql = `
      SELECT 
        MONTH(date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM bills
      WHERE YEAR(date) = ?
      GROUP BY MONTH(date)
      ORDER BY month
    `;
    const [monthlyData] = await pool.execute(monthlySql, [year]);

    // Category summary
    let categorySql = `
      SELECT 
        category,
        type,
        SUM(amount) as total,
        COUNT(*) as count
      FROM bills
      WHERE YEAR(date) = ?
    `;
    const categoryParams = [year];

    if (month) {
      categorySql += ' AND MONTH(date) = ?';
      categoryParams.push(month);
    }

    categorySql += ' GROUP BY category, type ORDER BY total DESC';

    const [categoryData] = await pool.execute(categorySql, categoryParams);

    // Total summary
    let totalSql = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
        COUNT(*) as totalCount
      FROM bills
      WHERE YEAR(date) = ?
    `;
    const totalParams = [year];
    if (month) {
      totalSql += ' AND MONTH(date) = ?';
      totalParams.push(month);
    }

    const [totalData] = await pool.execute(totalSql, totalParams);

    res.json({
      success: true,
      data: {
        monthly: monthlyData,
        category: categoryData,
        total: totalData[0]
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
