import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGlobalAuth } from '@/features/auth/contexts';
import { useToast } from '@/shared/hooks/use-toast';
import {
  checkPasswordStrength,
  validatePasswordRequirements,
} from '@/features/auth/utils/authValidation';

export function useBuyerResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const email = searchParams.get('email') || '';
    const { toast } = useToast();
    const { resetPassword, isLoading } = useGlobalAuth();
    const resetBuyerPassword = (token: string, newPassword: string, email: string) => resetPassword(token, newPassword, email, 'buyer');
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);



    // Verify token on component mount
    useEffect(() => {
        if (!token) {
            setIsValidToken(false);
            toast({
                title: 'Invalid Token',
                description: 'No reset token provided. Please use the link from your email.',
                variant: 'destructive',
            });
            return;
        }

        // For buyer tokens, we'll check if it looks like a valid hex token (not JWT)
        const isValidHexToken = /^[a-f0-9]{64}$/.test(token);
        setIsValidToken(isValidHexToken);

        if (!isValidHexToken) {
            toast({
                title: 'Invalid Token',
                description: 'Invalid reset token format. Please use the link from your email.',
                variant: 'destructive',
            });
        }
    }, [token, toast]);

    const validatePasswords = (password: string, confirmPassword: string, showToast = true): boolean => {
        const result = validatePasswordRequirements(password, confirmPassword);
        if (!result.isValid) {
            if (showToast && result.error) {
                setPasswordError(result.error);
                toast({
                    title: result.error === 'Passwords do not match' ? 'Validation Error' : 'Weak Password',
                    description: result.error,
                    variant: 'destructive',
                });
            }
            return false;
        }

        setPasswordError('');
        return true;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token || !isValidToken) {
            toast({
                title: 'Invalid Token',
                description: 'Please use the reset link from your email.',
                variant: 'destructive',
            });
            return;
        }

        if (!email) {
            toast({
                title: 'Missing Email',
                description: 'Reset link is missing your email address. Please request a new link.',
                variant: 'destructive',
            });
            return;
        }

        if (!validatePasswords(formData.password, formData.confirmPassword)) {
            return;
        }

        try {
            await resetBuyerPassword(token, formData.password, email);
            toast({
                title: 'Success',
                description: 'Your password has been reset successfully.',
            });
            navigate('/buyer/login');
        } catch (error) {
            // Error is already handled by the auth context
        }
    };

    const strength = checkPasswordStrength(formData.password);


    return {
        isValidToken,
        formData,
        handleInputChange,
        handleSubmit,
        showPassword,
        setShowPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        passwordError,
        isLoading,
        strength,
    };
}
