const mongoose = require('mongoose');
const Scholarship = require('../models/Scholarship');
const { findEligibleSchemes } = require('../services/eligibilityService');
const { scholarshipDataset } = require('../seed/seedScholarships');

/**
 * Health check endpoint.
 */
const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Retrieve all scholarships from the database (with offline fallback).
 */
const getAllSchemes = async (req, res) => {
  try {
    let schemes = [];
    if (mongoose.connection.readyState === 1) {
      schemes = await Scholarship.find().sort({ name: 1 }).lean();
    }

    if (!schemes || schemes.length === 0) {
      schemes = scholarshipDataset;
    }

    return res.status(200).json({
      success: true,
      count: schemes.length,
      schemes,
      source: mongoose.connection.readyState === 1 ? 'database' : 'fallback_dataset',
    });
  } catch (error) {
    console.warn('[Schemes Fetch Warning] Using fallback dataset:', error.message);
    return res.status(200).json({
      success: true,
      count: scholarshipDataset.length,
      schemes: scholarshipDataset,
      source: 'fallback_dataset',
    });
  }
};

/**
 * Evaluate student profile against all scholarships using rule-based eligibility engine.
 */
const checkStudentEligibility = async (req, res) => {
  try {
    const { category, income, courseLevel, percentage, hasDisability, state } = req.body;

    const studentProfile = {
      category: category.trim(),
      income: Number(income),
      courseLevel: courseLevel.trim(),
      percentage: Number(percentage),
      hasDisability: hasDisability === true || hasDisability === 'Yes' || hasDisability === 'yes',
      state: state ? state.trim() : 'Maharashtra',
    };

    let allSchemes = [];
    if (mongoose.connection.readyState === 1) {
      try {
        allSchemes = await Scholarship.find().lean();
      } catch (dbErr) {
        console.warn('[Eligibility DB Warning] Falling back to static dataset:', dbErr.message);
      }
    }

    if (!allSchemes || allSchemes.length === 0) {
      allSchemes = scholarshipDataset;
    }

    // Run deterministic rule engine
    const matchingSchemes = findEligibleSchemes(studentProfile, allSchemes);

    return res.status(200).json({
      success: true,
      count: matchingSchemes.length,
      schemes: matchingSchemes,
      studentProfile,
      source: mongoose.connection.readyState === 1 ? 'database' : 'fallback_dataset',
    });
  } catch (error) {
    console.error('Error evaluating eligibility:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process eligibility check right now. Please try again.',
    });
  }
};

module.exports = {
  getHealth,
  getAllSchemes,
  checkStudentEligibility,
};
