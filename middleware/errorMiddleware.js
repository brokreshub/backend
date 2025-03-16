const errorMiddleware = (err, req, res, next) => {
    console.error(err.stack);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: err.message
        });
    }
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid token'
        });
    }
    
    // Default error
    res.status(500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
};

module.exports = errorMiddleware; 