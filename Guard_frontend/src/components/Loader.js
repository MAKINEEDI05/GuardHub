import React from 'react';
import styled from 'styled-components';

const Loader = ({ size = 13.6, color = '#076fe5', withOverlay = true }) => {
    return (
        <StyledWrapper $size={size} $color={color} $withOverlay={withOverlay} role="status" aria-label="Loading">
            <div className="loader">
                <div className="justify-content-center jimu-primary-loading" />
            </div>
        </StyledWrapper>
    );
};

const StyledWrapper = styled.div`
  .loader {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background: ${(props) => (props.$withOverlay ? 'rgba(255, 255, 255, 0.7)' : 'transparent')};
  }

  .jimu-primary-loading:before,
  .jimu-primary-loading:after {
    position: absolute;
    top: 0;
    content: '';
  }

  .jimu-primary-loading:before {
    left: -${(props) => props.$size * 1.47}px;
  }

  .jimu-primary-loading:after {
    left: ${(props) => props.$size * 1.47}px;
    animation-delay: 0.32s !important;
  }

  .jimu-primary-loading:before,
  .jimu-primary-loading:after,
  .jimu-primary-loading {
    background: ${(props) => props.$color};
    animation: loading-keys-app-loading 0.8s infinite ease-in-out;
    width: ${(props) => props.$size}px;
    height: ${(props) => props.$size * 2.35}px;
  }

  .jimu-primary-loading {
    text-indent: -9999em;
    margin: auto;
    position: absolute;
    right: calc(50% - ${(props) => props.$size / 2}px);
    top: calc(50% - ${(props) => props.$size * 1.175}px);
    animation-delay: 0.16s !important;
  }

  @keyframes loading-keys-app-loading {
    0%,
    80%,
    100% {
      opacity: 0.75;
      box-shadow: 0 0 ${(props) => props.$color};
      height: ${(props) => props.$size * 2.35}px;
    }
    40% {
      opacity: 1;
      box-shadow: 0 -${(props) => props.$size * 0.588}px ${(props) => props.$color};
      height: ${(props) => props.$size * 2.94}px;
    }
  }
`;

export default Loader;