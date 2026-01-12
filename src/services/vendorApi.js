// src/services/vendorApi.js
/**
 * Vendor API Service
 * Handles all HTTP requests related to vendor management
 * Uses native fetch API (no external dependencies)
 */

const API_BASE_URL =  process.env.REACT_APP_API_URL;
const VENDOR_ENDPOINT = `${API_BASE_URL}/api/vendors`;

class VendorApi {
  
  /**
   * Get vendors with filters and pagination
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object>} Paginated vendor response
   */
  async getVendors(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${VENDOR_ENDPOINT}${queryString ? '?' + queryString : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      this.handleError(error, 'Failed to fetch vendors');
    }
  }
  
  /**
   * Get single vendor by ID
   * @param {number} id - Vendor ID
   * @returns {Promise<Object>} Vendor details
   */
  async getVendorById(id) {
    try {
      const response = await fetch(`${VENDOR_ENDPOINT}/${id}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      this.handleError(error, `Failed to fetch vendor ${id}`);
    }
  }
  
  /**
   * Create new vendor
   * @param {Object} vendorData - Vendor data
   * @returns {Promise<Object>} Created vendor
   */
  async createVendor(vendorData) {
    try {
      const response = await fetch(VENDOR_ENDPOINT, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(vendorData)
      });
      
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      this.handleError(error, 'Failed to create vendor');
    }
  }
  
  /**
   * Update existing vendor
   * @param {number} id - Vendor ID
   * @param {Object} vendorData - Updated vendor data
   * @returns {Promise<Object>} Updated vendor
   */
  async updateVendor(id, vendorData) {
    try {
      const response = await fetch(`${VENDOR_ENDPOINT}/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(vendorData)
      });
      
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      this.handleError(error, `Failed to update vendor ${id}`);
    }
  }
  
  /**
   * Delete vendor (soft delete)
   * @param {number} id - Vendor ID
   * @returns {Promise<Object>} Success response
   */
  async deleteVendor(id) {
    try {
      const response = await fetch(`${VENDOR_ENDPOINT}/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      this.handleError(error, `Failed to delete vendor ${id}`);
    }
  }
  
  /**
   * Get vendor statistics
   * @returns {Promise<Object>} Vendor stats
   */
  async getStats() {
    try {
      const response = await fetch(`${VENDOR_ENDPOINT}/stats`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      this.handleError(error, 'Failed to fetch vendor statistics');
    }
  }
  
  /**
   * Get authorization headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-User-Id': userId || '',
      'X-User-Role': userRole || 'USER'
    };
  }
  
  /**
   * Handle error response from server
   * @param {Response} response - Fetch response object
   * @returns {Promise<Error>} Error object
   */
  async handleErrorResponse(response) {
    let errorMessage = 'An error occurred';
    
    try {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } else {
        errorMessage = await response.text() || errorMessage;
      }
    } catch (e) {
      // If parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }
    
    const error = new Error(errorMessage);
    error.status = response.status;
    return error;
  }
  
  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @param {string} defaultMessage - Default error message
   * @throws {Error} Formatted error
   */
  handleError(error, defaultMessage) {
    console.error(`API Error: ${defaultMessage}`, error);
    
    // If error already has a message, use it
    if (error.message && error.message !== defaultMessage) {
      throw error;
    }
    
    // Check for network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to reach server');
    }
    
    // Use default message
    throw new Error(defaultMessage);
  }
}

export default new VendorApi();