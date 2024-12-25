import React, { memo } from 'react'; // ^18.0.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { Box, Typography } from '@mui/material'; // ^5.0.0
import Button from '../common/Button';

// Interface for footer link items
export interface FooterLink {
  label: string;
  href: string;
  ariaLabel: string;
}

// Props interface for Footer component
export interface FooterProps {
  /** Optional CSS class for custom styling */
  className?: string;
  /** Optional array of custom footer links */
  customLinks?: FooterLink[];
}

// Default footer links
const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  {
    label: 'Privacy Policy',
    href: '/privacy',
    ariaLabel: 'View privacy policy'
  },
  {
    label: 'Terms of Service',
    href: '/terms',
    ariaLabel: 'View terms of service'
  },
  {
    label: 'Contact',
    href: '/contact',
    ariaLabel: 'Contact us'
  }
];

// Styled footer container with theme integration
const StyledFooter = styled(Box)(({ theme }) => ({
  width: '100%',
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3),
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),

  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing(3, 4)
  },

  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(4, 6)
  }
}));

// Styled link container
const LinkContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),

  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    gap: theme.spacing(4)
  }
}));

/**
 * Footer component that provides consistent layout and styling for the application's footer section
 * Implements responsive design, accessibility features, and theme integration
 * 
 * @component
 * @param {FooterProps} props - Component props
 * @returns {React.ReactElement} Rendered footer component
 */
export const Footer = memo(({ 
  className,
  customLinks = DEFAULT_FOOTER_LINKS 
}: FooterProps): React.ReactElement => {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <StyledFooter
      component="footer"
      className={className}
      role="contentinfo"
      aria-label="Site footer"
    >
      {/* Copyright section */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          textAlign: { xs: 'center', sm: 'left' }
        }}
      >
        © {currentYear} Knowledge Curator. All rights reserved.
      </Typography>

      {/* Navigation links */}
      <LinkContainer>
        {customLinks.map((link, index) => (
          <Button
            key={`footer-link-${index}`}
            variant="text"
            size="small"
            href={link.href}
            aria-label={link.ariaLabel}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                color: theme.palette.primary.main
              }
            }}
          >
            {link.label}
          </Button>
        ))}
      </LinkContainer>

      {/* Back to top button - Only visible on mobile */}
      <Box
        sx={{
          display: { xs: 'block', sm: 'none' },
          marginTop: theme.spacing(2)
        }}
      >
        <Button
          variant="text"
          size="small"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll back to top"
        >
          Back to top
        </Button>
      </Box>
    </StyledFooter>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;